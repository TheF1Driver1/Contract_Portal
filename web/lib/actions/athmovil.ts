"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { AthConnectSchema, AthPaymentCreateSchema, AthPaymentIdSchema } from "@/lib/schemas";
import { encryptField, fieldEncryptionEnabled } from "@/lib/crypto/fields";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { tenantHasLease } from "@/lib/maintenance/service";
import type { AthMovilPayment, Payment, RentCharge } from "@/lib/db";
import { summarize } from "@/lib/rent/schedule";
import { todayPR } from "@/lib/rent/service";
import { ATH_MAX_TOTAL, ATH_TIMEOUT_SECONDS, AthMovilError, cancelPayment, createPayment } from "@/lib/athmovil/client";
import { cancelAthPayment as cancelAth, loadAthAccount, syncAthPayment, type AthView } from "@/lib/athmovil/service";

export type AthActionResult = { ok: true } | { ok: false; error: string };
export type AthStartResult =
  | { ok: true; id: string; amount: number; business: string; expiresAt: string }
  | { ok: false; error: string };
export type AthCheckResult = { ok: true; status: AthView["status"]; amount: number; error: string | null } | { ok: false; error: string };

const EXPIRED = { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." } as const;
const TOO_MANY = { ok: false, error: "Demasiados intentos. Espera un minuto." } as const;
const NO_KEY = {
  ok: false,
  error: "No podemos guardar los tokens de ATH Móvil de forma segura todavía (falta la clave de cifrado del servidor). Escríbenos a soporte.",
} as const;
const invalid = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message?.startsWith("Teléfono") ? e.issues[0].message : `Revisa el campo: ${String(e.issues[0]?.path.at(-1) ?? "")}.` });

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ── Landlord: connect / disconnect ATH Business ─────────────────────────────

/** Saves the landlord's ATH Business tokens, encrypted. Refuses without an encryption key. */
export async function connectAthMovil(input: unknown): Promise<AthActionResult> {
  const parsed = AthConnectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return TOO_MANY;
  if (!fieldEncryptionEnabled()) return NO_KEY;

  const publicEnc = encryptField(parsed.data.public_token);
  const privateEnc = parsed.data.private_token ? encryptField(parsed.data.private_token) : null;
  // Belt and braces: never write a token that did not come back encrypted.
  if (!publicEnc?.startsWith("enc:v1:") || (privateEnc !== null && !privateEnc.startsWith("enc:v1:"))) return NO_KEY;

  // ath_movil_accounts has no client policies; the service role writes the caller's own row.
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const values = { public_token_enc: publicEnc, private_token_enc: privateEnc, business_name: parsed.data.business_name || null, updated_at: now };
  const { data: existing } = await admin.from("ath_movil_accounts").select("owner_id").eq("owner_id", user.id).maybeSingle();
  const { error } = existing
    ? await admin.from("ath_movil_accounts").update(values).eq("owner_id", user.id)
    : await admin.from("ath_movil_accounts").insert({ ...values, owner_id: user.id, connected_at: now });
  if (error) return { ok: false, error: "No se pudo conectar ATH Móvil." };
  revalidatePath("/rent");
  return { ok: true };
}

export async function disconnectAthMovil(): Promise<AthActionResult> {
  const { user } = await session();
  if (!user) return EXPIRED;
  const { error } = await createAdminClient().from("ath_movil_accounts").delete().eq("owner_id", user.id);
  if (error) return { ok: false, error: "No se pudo desconectar ATH Móvil." };
  revalidatePath("/rent");
  revalidatePath("/portal");
  return { ok: true };
}

// ── Tenant: pay from the portal ─────────────────────────────────────────────

/** Starts an ATH Móvil payment for the current balance of a lease the tenant holds. */
export async function createAthPayment(input: unknown): Promise<AthStartResult> {
  const parsed = AthPaymentCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return TOO_MANY;
  if (!fieldEncryptionEnabled()) return { ok: false, error: "Los pagos con ATH Móvil no están disponibles en este momento." };
  const { contract_id, amount, phone } = parsed.data;

  const admin = createAdminClient();
  if (!(await tenantHasLease(admin, user.id, contract_id))) return { ok: false, error: "Contrato no encontrado." };
  const { data: contract } = await admin
    .from("contracts")
    .select("id, owner_id, status, unit_number, property:properties(name)")
    .eq("id", contract_id)
    .maybeSingle();
  if (!contract || contract.status !== "signed") return { ok: false, error: "Contrato no encontrado." };

  const account = await loadAthAccount(admin, contract.owner_id);
  if (!account) return { ok: false, error: "Tu arrendador no recibe pagos con ATH Móvil." };

  // One payment in flight per lease and tenant: resume it instead of starting another.
  const since = new Date(Date.now() - ATH_TIMEOUT_SECONDS * 1000).toISOString();
  const { data: inflight } = await admin
    .from("ath_movil_payments")
    .select("id, amount, created_at")
    .eq("contract_id", contract_id)
    .eq("payer_user_id", user.id)
    .in("status", ["open", "confirm"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const business = account.businessName || "tu arrendador";
  if (inflight) {
    const expiresAt = new Date(new Date(inflight.created_at).getTime() + ATH_TIMEOUT_SECONDS * 1000).toISOString();
    return { ok: true, id: inflight.id, amount: Number(inflight.amount), business, expiresAt };
  }

  const today = todayPR();
  const [{ data: ledger }, { data: charges }, { data: payments }] = await Promise.all([
    admin.from("rent_ledgers").select("contract_id").eq("contract_id", contract_id).maybeSingle(),
    admin.from("rent_charges").select("*").eq("contract_id", contract_id),
    admin.from("payments").select("*").eq("contract_id", contract_id),
  ]);
  if (!ledger) return { ok: false, error: "Este contrato no tiene cuenta de renta." };
  const s = summarize(
    ((charges ?? []) as RentCharge[]).map((c) => ({ kind: c.kind, period: c.period, due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at })),
    ((payments ?? []) as Payment[]).map((p) => ({ amount: Number(p.amount), received_on: p.received_on, voided: !!p.voided_at })),
    today
  );
  const max = Math.min(Math.round(s.balance * 100) / 100, ATH_MAX_TOTAL);
  if (max < 1) return { ok: false, error: "No tienes balance pendiente." };
  if (amount > max) return { ok: false, error: "La cantidad es mayor que tu balance." };

  const property = (contract.property as { name?: string | null } | null)?.name ?? "";
  const ref = `Contrato ${contract_id.slice(0, 8)}`;
  let started: { ecommerceId: string; authToken: string };
  try {
    started = await createPayment({
      publicToken: account.publicToken,
      total: amount,
      phoneNumber: phone,
      metadata1: `Renta ${today.slice(0, 7)}`,
      metadata2: ref,
      items: [
        {
          name: "Renta",
          description: [property, contract.unit_number].filter(Boolean).join(" ").slice(0, 60) || "Renta",
          quantity: "1",
          price: amount.toFixed(2),
          tax: "0.00",
          metadata: ref,
        },
      ],
    });
  } catch (e) {
    const msg = e instanceof AthMovilError ? e.message : "No se pudo iniciar el pago.";
    console.error(JSON.stringify({ level: "warn", msg: "ath create payment failed", contract: contract_id, code: e instanceof AthMovilError ? e.errorcode : null }));
    return { ok: false, error: `ATH Móvil: ${msg}` };
  }

  const authEnc = encryptField(started.authToken);
  const { data: row, error } = await admin
    .from("ath_movil_payments")
    .insert({
      owner_id: contract.owner_id,
      contract_id,
      payer_user_id: user.id,
      phone,
      amount,
      ecommerce_id: started.ecommerceId,
      auth_token_enc: authEnc,
      status: "open",
    })
    .select("id, created_at")
    .single();
  if (error || !row) {
    // Don't leave a payment the tenant could confirm but we could never authorize.
    await cancelPayment({ publicToken: account.publicToken, ecommerceId: started.ecommerceId, authToken: started.authToken }).catch(() => undefined);
    return { ok: false, error: "No se pudo iniciar el pago." };
  }
  const expiresAt = new Date(new Date(row.created_at ?? Date.now()).getTime() + ATH_TIMEOUT_SECONDS * 1000).toISOString();
  return { ok: true, id: row.id, amount, business, expiresAt };
}

async function payerRow(id: unknown): Promise<{ row: Pick<AthMovilPayment, "id" | "contract_id"> } | { error: AthCheckResult }> {
  const parsed = AthPaymentIdSchema.safeParse(id);
  if (!parsed.success) return { error: { ok: false, error: "Pago no encontrado." } };
  const { user } = await session();
  if (!user) return { error: EXPIRED };
  if (await rateLimitRead(user.id)) return { error: TOO_MANY };
  const { data } = await createAdminClient()
    .from("ath_movil_payments")
    .select("id, contract_id")
    .eq("id", parsed.data)
    .eq("payer_user_id", user.id)
    .maybeSingle();
  if (!data) return { error: { ok: false, error: "Pago no encontrado." } };
  return { row: data };
}

/** Polled by the portal every few seconds while the tenant confirms in the app. */
export async function checkAthPayment(id: unknown): Promise<AthCheckResult> {
  const r = await payerRow(id);
  if ("error" in r) return r.error;
  const v = await syncAthPayment(createAdminClient(), r.row.id);
  if (!v) return { ok: false, error: "Pago no encontrado." };
  if (v.status === "completed") {
    revalidatePath("/portal");
    revalidatePath(`/contracts/${r.row.contract_id}`);
    revalidatePath("/rent");
  }
  return { ok: true, status: v.status, amount: v.amount, error: v.error };
}

export async function cancelAthPayment(id: unknown): Promise<AthCheckResult> {
  const r = await payerRow(id);
  if ("error" in r) return r.error;
  const v = await cancelAth(createAdminClient(), r.row.id);
  if (!v) return { ok: false, error: "Pago no encontrado." };
  return { ok: true, status: v.status, amount: v.amount, error: v.error };
}
