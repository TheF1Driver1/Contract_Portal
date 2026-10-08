import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthMovilPayment, AthPaymentStatus, Database } from "@/lib/db";
import { decryptField } from "@/lib/crypto/fields";
import { todayPR } from "@/lib/rent/service";
import { emailReceipt, receiptFor } from "@/lib/rent/receipt-data";
import {
  ATH_ERRORS,
  ATH_TIMEOUT_SECONDS,
  AthMovilError,
  authorizePayment,
  cancelPayment,
  findPayment,
  type AthTransaction,
} from "@/lib/athmovil/client";

// Tenant ATH Móvil payments → rent ledger (Plan 33).
//
// State machine for one ath_movil_payments row:
//   open ──(customer confirms in app)──▶ confirm ──(we call /authorization)──▶ completed
//     └────────────(timeout / cancel)──────────────▶ cancel
// Every transition is a conditional update, so concurrent polls (the portal
// every 4 s, the daily cron) cannot double-post: only one request claims the
// authorization (authorizing_at), and the ledger payment is keyed by the
// unique payments.external_id ("athm:<referenceNumber>"), so a second insert
// fails with 23505 and only the request that inserted sends the receipt.

type Client = SupabaseClient<Database>;

export type AthDeps = {
  fetch?: typeof fetch;
  /** Emails the receipt for a freshly posted payment. Throws on failure. */
  sendReceipt?: (admin: Client, paymentId: string) => Promise<void>;
  now?: Date;
};

export type AthView = {
  id: string;
  status: AthPaymentStatus;
  amount: number;
  paymentId: string | null;
  error: string | null;
};

const TERMINAL: AthPaymentStatus[] = ["completed", "cancel", "failed"];
/** A claim older than this is considered abandoned (the request died). */
const CLAIM_STALE_MS = 60_000;
/** Payer has ATH_TIMEOUT_SECONDS; after this margin an open row is stale. */
export const STALE_AFTER_MS = (ATH_TIMEOUT_SECONDS + 300) * 1000;

/** Attempts started after this instant may still be awaiting the payer. */
export function athPendingSince(now = new Date()): string {
  return new Date(now.getTime() - ATH_TIMEOUT_SECONDS * 1000).toISOString();
}

const view = (r: AthMovilPayment): AthView => ({ id: r.id, status: r.status, amount: Number(r.amount), paymentId: r.payment_id, error: r.error });
const clipErr = (s: string) => s.slice(0, 300);

export type AthAccount = { publicToken: string; privateToken: string | null; businessName: string | null };

/** The landlord's decrypted ATH Business tokens, or null when not connected (or undecryptable). */
export async function loadAthAccount(admin: Client, ownerId: string): Promise<AthAccount | null> {
  const { data } = await admin.from("ath_movil_accounts").select("*").eq("owner_id", ownerId).maybeSingle();
  if (!data) return null;
  const publicToken = decryptField(data.public_token_enc);
  if (!publicToken || publicToken === data.public_token_enc) return null; // stored only encrypted
  return { publicToken, privateToken: decryptField(data.private_token_enc), businessName: data.business_name };
}

async function defaultSendReceipt(admin: Client, paymentId: string) {
  const r = await receiptFor(admin, paymentId);
  if (!r || !r.tenantEmail) return;
  await emailReceipt(r);
  await admin.from("payments").update({ receipt_sent_at: new Date().toISOString() }).eq("id", paymentId);
}

async function reload(admin: Client, id: string): Promise<AthMovilPayment | null> {
  const { data } = await admin.from("ath_movil_payments").select("*").eq("id", id).maybeSingle();
  return (data as AthMovilPayment | null) ?? null;
}

async function setStatus(admin: Client, row: AthMovilPayment, to: AthPaymentStatus, extra: Partial<AthMovilPayment> = {}, now = new Date()) {
  await admin
    .from("ath_movil_payments")
    .update({ status: to, updated_at: now.toISOString(), ...extra })
    .eq("id", row.id)
    .in("status", ["open", "confirm"]);
}

/**
 * Posts a completed ATH payment to the ledger exactly once and links it.
 * Returns the ledger payment id.
 */
export async function recordCompletion(admin: Client, row: AthMovilPayment, tx: AthTransaction, deps: AthDeps = {}): Promise<string | null> {
  if (row.payment_id) return row.payment_id;
  const now = deps.now ?? new Date();
  const reference = tx.referenceNumber ?? null;
  const externalId = `athm:${reference ?? row.ecommerce_id}`;
  const amount = tx.total && tx.total > 0 ? Math.round(tx.total * 100) / 100 : Number(row.amount);

  let paymentId: string | null = null;
  let inserted = false;
  const ins = await admin
    .from("payments")
    .insert({
      contract_id: row.contract_id,
      owner_id: row.owner_id,
      amount,
      method: "ath_movil",
      source: "ath_movil",
      external_id: externalId,
      received_on: todayPR(now),
      reference: reference ? reference.slice(0, 100) : null,
      note: "ATH Móvil (portal)",
    })
    .select("id")
    .single();
  if (!ins.error && ins.data) {
    paymentId = ins.data.id;
    inserted = true;
  } else {
    // 23505: another request posted it first. Anything else: look it up anyway.
    const { data: existing } = await admin.from("payments").select("id").eq("external_id", externalId).maybeSingle();
    paymentId = existing?.id ?? null;
    if (!paymentId) {
      await admin.from("ath_movil_payments").update({ error: clipErr("No se pudo registrar el pago en la cuenta."), updated_at: now.toISOString() }).eq("id", row.id);
      return null;
    }
  }

  await admin
    .from("ath_movil_payments")
    .update({ status: "completed", reference_number: reference, payment_id: paymentId, error: null, updated_at: now.toISOString() })
    .eq("id", row.id)
    .is("payment_id", null);

  if (inserted) {
    try {
      await (deps.sendReceipt ?? defaultSendReceipt)(admin, paymentId);
    } catch (e) {
      console.error(JSON.stringify({ level: "warn", msg: "ath receipt not sent", payment: paymentId, err: String((e as Error)?.message ?? e) }));
    }
  }
  return paymentId;
}

/** Claims the right to call /authorization for this row. Only one request wins. */
async function claimAuthorization(admin: Client, row: AthMovilPayment, now: Date): Promise<boolean> {
  const stamp = now.toISOString();
  let q = admin.from("ath_movil_payments").update({ authorizing_at: stamp, status: "confirm", updated_at: stamp }).eq("id", row.id).in("status", ["open", "confirm"]);
  if (row.authorizing_at) {
    if (now.getTime() - new Date(row.authorizing_at).getTime() < CLAIM_STALE_MS) return false;
    q = q.eq("authorizing_at", row.authorizing_at); // take over an abandoned claim
  } else {
    q = q.is("authorizing_at", null);
  }
  const { data } = await q.select("id");
  return !!data?.length;
}

/**
 * Brings one row up to date with ATH Móvil: authorizes confirmed payments,
 * records completed ones, closes cancelled/expired ones. Safe to call
 * concurrently and repeatedly.
 */
export async function syncAthPayment(admin: Client, id: string, deps: AthDeps = {}): Promise<AthView | null> {
  const now = deps.now ?? new Date();
  const row = await reload(admin, id);
  if (!row) return null;
  if (row.status === "completed" && !row.payment_id) {
    // Completed at ATH but the ledger insert failed earlier: retry it.
  } else if (TERMINAL.includes(row.status)) {
    return view(row);
  }

  const account = await loadAthAccount(admin, row.owner_id);
  if (!account) return { ...view(row), error: "El arrendador desconectó ATH Móvil." };
  const authToken = decryptField(row.auth_token_enc);
  const opts = { fetch: deps.fetch };

  let tx: AthTransaction;
  try {
    tx = await findPayment({ publicToken: account.publicToken, ecommerceId: row.ecommerce_id, authToken }, opts);
  } catch (e) {
    const code = e instanceof AthMovilError ? e.errorcode : null;
    if (code === ATH_ERRORS.expired) {
      await setStatus(admin, row, "cancel", { error: "Expiró sin confirmarse." }, now);
    } else if (code === ATH_ERRORS.notFound && now.getTime() - new Date(row.created_at).getTime() > STALE_AFTER_MS) {
      await setStatus(admin, row, "failed", { error: "ATH Móvil no encontró el pago." }, now);
    } else {
      return { ...view(row), error: e instanceof AthMovilError ? e.message : "No se pudo consultar ATH Móvil." };
    }
    return view((await reload(admin, id)) ?? row);
  }

  const status = String(tx.ecommerceStatus).toUpperCase();
  if (status === "OPEN") return view(row);

  if (status === "CANCEL") {
    await setStatus(admin, row, "cancel", { error: null }, now);
    return view((await reload(admin, id)) ?? row);
  }

  if (status === "CONFIRM") {
    if (!authToken) {
      await setStatus(admin, row, "failed", { error: "Falta el token de autorización." }, now);
      return view((await reload(admin, id)) ?? row);
    }
    if (!(await claimAuthorization(admin, row, now))) {
      // Another request is authorizing right now; the next poll sees the result.
      return { ...view(row), status: "confirm" };
    }
    try {
      tx = await authorizePayment(authToken, opts);
    } catch (e) {
      const code = e instanceof AthMovilError ? e.errorcode : null;
      // It may have gone through anyway (e.g. a timeout after ATH processed it).
      const again = await findPayment({ publicToken: account.publicToken, ecommerceId: row.ecommerce_id, authToken }, opts).catch(() => null);
      if (again && String(again.ecommerceStatus).toUpperCase() === "COMPLETED") {
        tx = again;
      } else if (code === ATH_ERRORS.expired || (again && String(again.ecommerceStatus).toUpperCase() === "CANCEL")) {
        await setStatus(admin, row, "cancel", { error: "Expiró antes de autorizarse." }, now);
        return view((await reload(admin, id)) ?? row);
      } else {
        await admin
          .from("ath_movil_payments")
          .update({ authorizing_at: null, error: clipErr(e instanceof AthMovilError ? e.message : "No se pudo autorizar."), updated_at: now.toISOString() })
          .eq("id", row.id);
        return { ...view(row), status: "confirm" };
      }
    }
  } else if (status !== "COMPLETED") {
    return view(row);
  }

  const fresh = (await reload(admin, id)) ?? row;
  await recordCompletion(admin, fresh, tx, deps);
  return view((await reload(admin, id)) ?? fresh);
}

/** Tenant pressed "Cancelar": cancel at ATH while still open. */
export async function cancelAthPayment(admin: Client, id: string, deps: AthDeps = {}): Promise<AthView | null> {
  const now = deps.now ?? new Date();
  const row = await reload(admin, id);
  if (!row) return null;
  if (row.status !== "open") return syncAthPayment(admin, id, deps);
  const account = await loadAthAccount(admin, row.owner_id);
  if (account) {
    try {
      await cancelPayment({ publicToken: account.publicToken, ecommerceId: row.ecommerce_id, authToken: decryptField(row.auth_token_enc) }, { fetch: deps.fetch });
    } catch {
      // The customer may have confirmed meanwhile: let the normal sync decide.
      const synced = await syncAthPayment(admin, id, deps);
      if (synced && synced.status !== "open") return synced;
    }
  }
  await admin
    .from("ath_movil_payments")
    .update({ status: "cancel", error: null, updated_at: now.toISOString() })
    .eq("id", row.id)
    .eq("status", "open");
  return view((await reload(admin, id)) ?? row);
}

/**
 * Daily safety net (rent cron): finish payments whose portal tab was closed
 * before they completed, and close the ones that expired.
 */
export async function reconcileAthPayments(admin: Client, deps: AthDeps = {}): Promise<{ checked: number; completed: number; cancelled: number; errors: string[] }> {
  const now = deps.now ?? new Date();
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const { data, error } = await admin.from("ath_movil_payments").select("*").in("status", ["open", "confirm"]).gte("created_at", since);
  if (error) return { checked: 0, completed: 0, cancelled: 0, errors: [error.message] };
  const out = { checked: 0, completed: 0, cancelled: 0, errors: [] as string[] };
  for (const row of (data ?? []) as AthMovilPayment[]) {
    out.checked++;
    try {
      let v = await syncAthPayment(admin, row.id, deps);
      const stale = now.getTime() - new Date(row.created_at).getTime() > STALE_AFTER_MS;
      if (v && v.status === "open" && stale) v = await cancelAthPayment(admin, row.id, deps);
      if (v?.status === "completed") out.completed++;
      if (v?.status === "cancel") out.cancelled++;
      // Provider-side errors (ATH down, not yet authorized) retry next run; only log them.
      if (v?.error && v.status !== "cancel") console.error(JSON.stringify({ level: "warn", msg: "ath reconcile pending", id: row.id, status: v.status, err: v.error }));
    } catch (e) {
      out.errors.push(`${row.id}: ${String((e as Error)?.message ?? e)}`);
    }
  }
  return out;
}
