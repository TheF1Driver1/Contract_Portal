"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { ChargeCreateSchema, LedgerEnableSchema, LedgerSettingsSchema, PaymentCreateSchema, VoidSchema } from "@/lib/schemas";
import { postDueCharges, todayPR } from "@/lib/rent/service";
import { emailReceipt, receiptFor } from "@/lib/rent/receipt-data";
import { trackEvent } from "@/lib/analytics";

export type RentActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };

const invalid = (e: z.ZodError): RentActionResult => ({ ok: false, error: `Revisa el campo: ${String(e.issues[0]?.path.at(-1) ?? "")}.` });
const EXPIRED: RentActionResult = { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const refresh = (contractId: string) => {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/rent");
  revalidatePath("/dashboard");
};

/** Starts the rent ledger for a signed lease and posts what is already due. */
export async function enableLedger(input: unknown): Promise<RentActionResult> {
  const parsed = LedgerEnableSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { contract_id, started_on, late_fees } = parsed.data;

  const { data: contract } = await supabase.from("contracts").select("id, status").eq("id", contract_id).eq("owner_id", user.id).maybeSingle();
  if (!contract) return { ok: false, error: "Contrato no encontrado." };
  if (contract.status !== "signed") return { ok: false, error: "Solo los contratos firmados llevan cuenta de renta." };

  const { error } = await supabase.from("rent_ledgers").insert({ contract_id, owner_id: user.id, started_on, late_fees });
  if (error) return { ok: false, error: error.code === "23505" ? "Este contrato ya tiene cuenta de renta." : "No se pudo activar la cuenta de renta." };

  // Ownership is verified above; the service role posts the charges.
  const res = await postDueCharges(createAdminClient(), todayPR(), contract_id).catch((e) => ({ errors: [String(e)] }));
  if (res.errors.length) console.error(JSON.stringify({ level: "error", msg: "post charges on enable failed", contract: contract_id, errors: res.errors }));
  await trackEvent("ledger_enabled");
  refresh(contract_id);
  return { ok: true, id: contract_id };
}

export async function updateLedgerSettings(input: unknown): Promise<RentActionResult> {
  const parsed = LedgerSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { data, error } = await supabase
    .from("rent_ledgers")
    .update({ late_fees: parsed.data.late_fees })
    .eq("contract_id", parsed.data.contract_id)
    .select("contract_id");
  if (error || !data?.length) return { ok: false, error: "No se pudo guardar." };
  refresh(parsed.data.contract_id);
  return { ok: true };
}

export async function recordPayment(input: unknown): Promise<RentActionResult> {
  const parsed = PaymentCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { send_receipt, ...values } = parsed.data;
  if (values.received_on > todayPR()) return { ok: false, error: "La fecha del pago no puede ser futura." };

  const { data: ledger } = await supabase.from("rent_ledgers").select("contract_id").eq("contract_id", values.contract_id).maybeSingle();
  if (!ledger) return { ok: false, error: "Activa la cuenta de renta de este contrato primero." };

  const { data, error } = await supabase
    .from("payments")
    .insert({ ...values, reference: values.reference || null, note: values.note || null, owner_id: user.id, source: "manual" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo registrar el pago." };
  await trackEvent("payment_recorded", { method: values.method });

  let warning: string | undefined;
  if (send_receipt) {
    try {
      const r = await receiptFor(supabase, data.id);
      if (r) {
        await emailReceipt(r);
        await supabase.from("payments").update({ receipt_sent_at: new Date().toISOString() }).eq("id", data.id);
      }
    } catch (e) {
      warning = `Pago registrado, pero no se envió el recibo: ${(e as Error).message}`;
    }
  }
  refresh(values.contract_id);
  return { ok: true, id: data.id, warning };
}

export async function resendReceipt(paymentId: string): Promise<RentActionResult> {
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const r = await receiptFor(supabase, paymentId);
  if (!r) return { ok: false, error: "Pago no encontrado." };
  try {
    await emailReceipt(r, { resend: true });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await supabase.from("payments").update({ receipt_sent_at: new Date().toISOString() }).eq("id", paymentId);
  return { ok: true };
}

export async function addCharge(input: unknown): Promise<RentActionResult> {
  const parsed = ChargeCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { data: ledger } = await supabase.from("rent_ledgers").select("contract_id").eq("contract_id", parsed.data.contract_id).maybeSingle();
  if (!ledger) return { ok: false, error: "Activa la cuenta de renta de este contrato primero." };
  const { data, error } = await supabase
    .from("rent_charges")
    .insert({ ...parsed.data, kind: "other", period: null, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo añadir el cargo." };
  refresh(parsed.data.contract_id);
  return { ok: true, id: data.id };
}

async function voidRow(table: "payments" | "rent_charges", input: unknown): Promise<RentActionResult> {
  const parsed = VoidSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { data, error } = await supabase
    .from(table)
    .update({ voided_at: new Date().toISOString(), void_reason: parsed.data.reason })
    .eq("id", parsed.data.id)
    .is("voided_at", null)
    .select("contract_id");
  if (error || !data?.length) return { ok: false, error: "No se pudo anular." };
  refresh(data[0].contract_id);
  return { ok: true };
}

export async function voidPayment(input: unknown) {
  return voidRow("payments", input);
}

export async function voidCharge(input: unknown) {
  return voidRow("rent_charges", input);
}
