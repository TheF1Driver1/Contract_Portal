import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Payment } from "@/lib/db";
import { emailT } from "@/lib/emails/translator";
import { sendMessage } from "@/lib/messaging";
import { receiptFormatters, receiptNumber, renderReceipt, type ReceiptData } from "@/lib/rent/receipt";

type Client = SupabaseClient<Database>;

/** Receipt fields for one payment. The client's RLS decides who may read it. */
export async function receiptFor(
  supabase: Client,
  paymentId: string
): Promise<{ data: ReceiptData; tenantEmail: string | null; tenantId: string | null; payment: Payment } | null> {
  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return null;
  const p = payment as Payment;
  const [{ data: contract }, { data: charges }, { data: payments }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, lease_start, lease_end, unit_number, owner_id, tenant:tenants(id, full_name, email, preferred_locale), property:properties(name, address, city)")
      .eq("id", p.contract_id)
      .maybeSingle(),
    supabase.from("rent_charges").select("amount, due_date, voided_at").eq("contract_id", p.contract_id),
    supabase.from("payments").select("amount, number, voided_at").eq("contract_id", p.contract_id),
  ]);
  if (!contract) return null;
  const { data: owner } = await supabase.from("profiles").select("full_name, company_name, email").eq("id", contract.owner_id).maybeSingle();

  const tenant = contract.tenant as { id?: string; full_name?: string; email?: string | null; preferred_locale?: string } | null;
  const property = contract.property as { name?: string; address?: string; city?: string } | null;
  // Balance as of the payment date: charges due by then, payments up to this one.
  const charged = (charges ?? []).filter((c) => !c.voided_at && c.due_date <= p.received_on).reduce((s, c) => s + Number(c.amount), 0);
  const paidThrough = (payments ?? []).filter((x) => !x.voided_at && x.number <= p.number).reduce((s, x) => s + Number(x.amount), 0);
  const locale = tenant?.preferred_locale ?? "es";
  const f = receiptFormatters(locale);

  return {
    payment: p,
    tenantEmail: tenant?.email ?? null,
    tenantId: tenant?.id ?? null,
    data: {
      number: p.number,
      amount: Number(p.amount),
      method: p.method,
      receivedOn: p.received_on,
      reference: p.reference,
      tenantName: tenant?.full_name ?? "—",
      landlordName: owner?.company_name || owner?.full_name || owner?.email || "—",
      property: [property?.name, contract.unit_number, property?.address, property?.city].filter(Boolean).join(", "),
      leaseLabel: `${f.date(contract.lease_start)} – ${f.date(contract.lease_end)}`,
      balanceAfter: Math.round((charged - paidThrough) * 100) / 100,
      voided: !!p.voided_at,
      locale,
    },
  };
}

/**
 * Emails the receipt PDF to the tenant in their language (logged in
 * message_log). `resend` sends again on purpose; otherwise a payment's
 * receipt goes out once. Throws when it could not be sent.
 */
export async function emailReceipt(
  r: { data: ReceiptData; tenantEmail: string | null; tenantId?: string | null; payment: Payment },
  opts: { resend?: boolean } = {}
): Promise<void> {
  if (!r.tenantEmail) throw new Error("El inquilino no tiene correo electrónico.");
  const { lang } = emailT(r.data.locale);
  const f = receiptFormatters(lang);
  const pdf = await renderReceipt(r.data);
  const res = await sendMessage({
    channel: "email",
    to: r.tenantEmail,
    template: "receipt",
    locale: lang,
    vars: {
      name: r.data.tenantName.split(" ")[0],
      landlord: r.data.landlordName,
      amount: f.money(r.data.amount),
      date: f.date(r.data.receivedOn),
      property: r.data.property,
      number: receiptNumber(r.data.number),
      balance: f.money(Math.max(r.data.balanceAfter, 0)),
      showBalance: r.data.balanceAfter > 0,
    },
    contractId: r.payment.contract_id,
    ownerId: r.payment.owner_id,
    recipient: { kind: "tenant", id: r.tenantId ?? null },
    idempotencyKey: opts.resend ? `receipt:${r.payment.id}:${Date.now()}` : `receipt:${r.payment.id}`,
    attachments: [{ filename: `${receiptNumber(r.data.number)}.pdf`, content: pdf }],
  });
  if (res.status === "failed") throw new Error(res.error ?? "No se pudo enviar el recibo.");
  if (res.status === "skipped" && res.skipped !== "duplicate") {
    throw new Error("No se pudo enviar el recibo.");
  }
}
