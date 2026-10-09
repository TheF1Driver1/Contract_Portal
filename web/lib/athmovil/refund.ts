import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { todayPR } from "@/lib/rent/service";
import { AthMovilError, refundPayment } from "./client";
import { loadAthAccount } from "./service";

type Client = SupabaseClient<Database>;

export type RefundCode = "not_found" | "not_ath" | "no_private_token" | "amount" | "in_flight" | "failed" | "unknown";
export type RefundResult = { ok: true; refunded: number; fullyRefunded: boolean } | { ok: false; code: RefundCode; error: string };

const fail = (code: RefundCode, error: string): RefundResult => ({ ok: false, code, error });
const cents = (n: number) => Math.round(n * 100) / 100;

/** How much of an ATH payment can still be refunded. */
export async function refundableAmount(admin: Client, paymentId: string, paymentAmount: number): Promise<number> {
  const { data } = await admin.from("ath_movil_refunds").select("amount").eq("payment_id", paymentId).eq("status", "completed");
  const done = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  return cents(Math.max(0, Number(paymentAmount) - done));
}

/**
 * Refunds (part of) an ATH Móvil rent payment back to the tenant.
 * - Ownership: the payment must belong to `ownerId`.
 * - Never twice: a pending/unknown refund row blocks another (unique index).
 * - API errors mark the attempt failed (safe to retry); no answer at all marks
 *   it unknown, which blocks further refunds until the landlord checks ATH
 *   Business and clears it.
 * - Ledger: a full refund voids the payment; a partial one adds a charge for
 *   the refunded amount, so the balance reflects the money returned.
 */
export async function refundAthPayment(
  admin: Client,
  opts: { ownerId: string; paymentId: string; amount: number; message?: string | null; now?: Date },
  deps: { fetch?: typeof fetch } = {}
): Promise<RefundResult> {
  const now = opts.now ?? new Date();
  const { data: payment } = await admin
    .from("payments")
    .select("id, owner_id, contract_id, amount, source, external_id, voided_at")
    .eq("id", opts.paymentId)
    .eq("owner_id", opts.ownerId)
    .maybeSingle();
  if (!payment) return fail("not_found", "No encontramos ese pago.");
  if (payment.source !== "ath_movil" || payment.voided_at) return fail("not_ath", "Solo se pueden reembolsar pagos de ATH Móvil vigentes.");

  const { data: athRow } = await admin.from("ath_movil_payments").select("reference_number").eq("payment_id", payment.id).maybeSingle();
  const reference = athRow?.reference_number ?? (payment.external_id?.startsWith("athm:") ? payment.external_id.slice(5) : null);
  if (!reference) return fail("not_ath", "Este pago no tiene número de referencia de ATH Móvil.");

  const amount = cents(opts.amount);
  const refundable = await refundableAmount(admin, payment.id, Number(payment.amount));
  if (!(amount >= 0.01) || amount > refundable) return fail("amount", `Puedes reembolsar hasta $${refundable.toFixed(2)}.`);

  const account = await loadAthAccount(admin, opts.ownerId);
  if (!account?.privateToken) {
    return fail("no_private_token", "Para reembolsar, agrega el token privado de ATH Business en Cobros → ATH Móvil Business.");
  }

  const message = opts.message?.trim().slice(0, 50) || null;
  const { data: claim, error: claimErr } = await admin
    .from("ath_movil_refunds")
    .insert({ owner_id: opts.ownerId, payment_id: payment.id, amount, message, status: "pending", created_at: now.toISOString() })
    .select("id")
    .single();
  if (claimErr || !claim) return fail("in_flight", "Ya hay un reembolso en curso o sin confirmar para este pago.");

  try {
    const tx = await refundPayment(
      { publicToken: account.publicToken, privateToken: account.privateToken, referenceNumber: reference, amount, message: message ?? undefined },
      { fetch: deps.fetch }
    );
    const refundRef = tx.referenceNumber ?? null;
    await admin
      .from("ath_movil_refunds")
      .update({ status: "completed", refund_reference: refundRef, completed_at: now.toISOString() })
      .eq("id", claim.id);

    const fullyRefunded = cents(refundable - amount) < 0.01;
    const label = `Reembolso ATH Móvil${refundRef ? ` (${refundRef})` : ""}`;
    if (fullyRefunded) {
      await admin.from("payments").update({ voided_at: now.toISOString(), void_reason: label }).eq("id", payment.id).is("voided_at", null);
    } else {
      await admin.from("rent_charges").insert({
        contract_id: payment.contract_id,
        owner_id: opts.ownerId,
        kind: "other",
        due_date: todayPR(now),
        amount,
        description: label,
      });
    }
    return { ok: true, refunded: amount, fullyRefunded };
  } catch (e) {
    const answered = e instanceof AthMovilError && e.httpStatus !== null;
    const error = (e instanceof Error ? e.message : "Error").slice(0, 300);
    await admin.from("ath_movil_refunds").update({ status: answered ? "failed" : "unknown", error }).eq("id", claim.id);
    return answered
      ? fail("failed", `ATH Móvil rechazó el reembolso: ${error}`)
      : fail("unknown", "ATH Móvil no respondió. Verifica en ATH Business si el reembolso se hizo antes de intentarlo de nuevo.");
  }
}

/** After checking ATH Business, the landlord marks an unanswered refund as not done. */
export async function clearUnknownRefund(admin: Client, ownerId: string, refundId: string): Promise<boolean> {
  const { data } = await admin
    .from("ath_movil_refunds")
    .update({ status: "failed", error: "Marcado como no realizado por el arrendador." })
    .eq("id", refundId)
    .eq("owner_id", ownerId)
    .eq("status", "unknown")
    .select("id");
  return !!data?.length;
}
