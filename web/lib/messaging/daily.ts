// Daily messaging job: rent reminders and overdue notices to tenants, and a
// digest email to landlords when something needs their attention.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Payment, RentCharge } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import { PLAN_LIMITS, type SubscriptionPlan } from "@/lib/types";
import { addDays, summarize } from "@/lib/rent/schedule";
import { sendMessage, type SendMessageResult } from "@/lib/messaging/send";
import { whatsappTemplate, type ListItem } from "@/lib/messaging/templates";
import { digestKey, pickTenantChannel, rentKey, rentNotices, type ConsentState } from "@/lib/messaging/rent-notices";

type Client = SupabaseClient<Database>;

export type DailySummary = { leases: number; sent: number; skipped: number; failed: number; duplicates: number; digests: number; errors: string[] };

function fmt(locale: string | null | undefined) {
  const tag = locale === "en" ? "en-US" : "es-US";
  return {
    money: (n: number) =>
      new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n),
    date: (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { dateStyle: "long", timeZone: "UTC" }),
  };
}

type LeaseRow = {
  id: string;
  owner_id: string;
  status: string;
  unit_number: string | null;
  late_fee_grace_period_days: number | null;
  tenant: { id: string; full_name: string; email: string | null; phone: string | null; preferred_locale: string | null } | null;
  property: { name: string | null } | null;
};

type OwnerRow = { id: string; email: string; full_name: string | null; company_name: string | null; locale: string; plan: string; digest_emails?: boolean };

const label = (l: { tenant: { full_name: string } | null; property: { name: string | null } | null }) =>
  [l.tenant?.full_name, l.property?.name].filter(Boolean).join(" · ") || "—";

const toCharge = (c: RentCharge) => ({ kind: c.kind, period: c.period, due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at });
const toPayment = (p: Payment) => ({ amount: Number(p.amount), received_on: p.received_on, voided: !!p.voided_at });

export async function runDailyMessages(db: Client, today: string, appUrl: string): Promise<DailySummary> {
  const s: DailySummary = { leases: 0, sent: 0, skipped: 0, failed: 0, duplicates: 0, digests: 0, errors: [] };
  const tally = (r: SendMessageResult, what: string) => {
    if (r.skipped === "duplicate") s.duplicates++;
    else if (r.status === "skipped") s.skipped++;
    else if (r.status === "failed") {
      s.failed++;
      s.errors.push(`${what}: ${r.error ?? "failed"}`);
    } else s.sent++;
  };

  // ── Leases with a rent ledger ──────────────────────────────────────────
  const { data: ledgers, error } = await db.from("rent_ledgers").select("contract_id, owner_id");
  if (error) throw new Error(error.message);
  const ids = (ledgers ?? []).map((l) => l.contract_id);
  const [{ data: leaseData }, { data: chargeData }, { data: paymentData }, { data: pendingData }] = await Promise.all([
    ids.length
      ? db
          .from("contracts")
          .select("id, owner_id, status, unit_number, late_fee_grace_period_days, tenant:tenants(id, full_name, email, phone, preferred_locale), property:properties(name)")
          .in("id", ids)
      : Promise.resolve({ data: [] }),
    ids.length ? db.from("rent_charges").select("*").in("contract_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("payments").select("*").in("contract_id", ids) : Promise.resolve({ data: [] }),
    db.from("contracts").select("id, owner_id, tenant:tenants(full_name), property:properties(name)").eq("status", "sent").limit(500),
  ]);
  const leases = ((leaseData ?? []) as unknown as LeaseRow[]).filter((l) => l.status === "signed");
  const charges = (chargeData ?? []) as RentCharge[];
  const payments = (paymentData ?? []) as Payment[];
  const pending = (pendingData ?? []) as unknown as { id: string; owner_id: string; tenant: { full_name: string } | null; property: { name: string | null } | null }[];
  s.leases = leases.length;

  const ownerIds = [...new Set([...leases.map((l) => l.owner_id), ...pending.map((p) => p.owner_id)])];
  const tenantIds = leases.map((l) => l.tenant?.id).filter((x): x is string => !!x);
  const [{ data: ownerData }, { data: consentData }] = await Promise.all([
    ownerIds.length
      ? db.from("profiles").select("id, email, full_name, company_name, locale, plan, digest_emails").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
    tenantIds.length
      ? db.from("messaging_consents").select("subject_id, channel, status, address").eq("subject_kind", "tenant").in("subject_id", tenantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const owners = new Map(((ownerData ?? []) as OwnerRow[]).map((o) => [o.id, o]));
  const consents = (consentData ?? []) as (ConsentState & { subject_id: string })[];

  // Digest items per owner.
  const digest = new Map<string, { overdue: ListItem[]; payments: ListItem[]; pending: ListItem[] }>();
  const bucket = (owner: string) => {
    if (!digest.has(owner)) digest.set(owner, { overdue: [], payments: [], pending: [] });
    return digest.get(owner)!;
  };

  // ── Tenant notices ─────────────────────────────────────────────────────
  for (const l of leases) {
    const mine = charges.filter((c) => c.contract_id === l.id).map(toCharge);
    const paid = payments.filter((p) => p.contract_id === l.id).map(toPayment);
    const owner = owners.get(l.owner_id);
    const ownerFmt = fmt(owner?.locale);
    const overdue = summarize(mine, paid, today).overdue;
    if (overdue > 0) bucket(l.owner_id).overdue.push({ who: label(l), amount: ownerFmt.money(overdue) });

    const tenant = l.tenant;
    if (!tenant) continue;
    const locale = tenant.preferred_locale === "en" ? "en" : "es";
    const f = fmt(locale);
    const plan = (owner?.plan && owner.plan in PLAN_LIMITS ? owner.plan : "free") as SubscriptionPlan;
    for (const n of rentNotices(mine, paid, today, Number(l.late_fee_grace_period_days) || 0)) {
      const template = n.kind === "reminder" ? ("rent_reminder" as const) : ("rent_overdue" as const);
      const pick = pickTenantChannel({
        consents: consents.filter((c) => c.subject_id === tenant.id),
        email: tenant.email,
        smsAllowed: hasFeature(plan, "sms"),
        whatsappReady: !!whatsappTemplate(template, locale, {}),
      });
      if (!pick) {
        s.skipped++;
        continue;
      }
      const r = await sendMessage({
        db,
        channel: pick.channel,
        to: pick.to,
        template,
        locale,
        vars: {
          name: tenant.full_name.split(" ")[0],
          amount: f.money(n.amount),
          date: f.date(n.dueDate),
          property: [l.property?.name, l.unit_number].filter(Boolean).join(" ") || "—",
          landlord: owner?.company_name || owner?.full_name || "",
        },
        contractId: l.id,
        ownerId: l.owner_id,
        recipient: { kind: "tenant", id: tenant.id },
        idempotencyKey: rentKey(l.id, n.period, n.kind),
      });
      tally(r, `${n.kind} ${l.id}`);
    }
  }

  // ── Landlord digest ────────────────────────────────────────────────────
  // Payments recorded yesterday (Puerto Rico is UTC-4 all year).
  const yesterday = addDays(today, -1);
  const from = `${yesterday}T04:00:00Z`;
  const to = `${today}T04:00:00Z`;
  for (const p of payments) {
    if (p.voided_at || p.created_at < from || p.created_at >= to) continue;
    const l = leases.find((x) => x.id === p.contract_id);
    if (l) bucket(l.owner_id).payments.push({ who: label(l), amount: fmt(owners.get(l.owner_id)?.locale).money(Number(p.amount)) });
  }
  for (const c of pending) bucket(c.owner_id).pending.push({ who: label(c) });

  for (const [ownerId, items] of digest) {
    const owner = owners.get(ownerId);
    if (!owner?.email || owner.digest_emails === false) continue;
    if (!items.overdue.length && !items.payments.length && !items.pending.length) continue;
    const r = await sendMessage({
      db,
      channel: "email",
      to: owner.email,
      template: "landlord_digest",
      locale: owner.locale,
      vars: { ...items, url: `${appUrl}/dashboard` },
      ownerId,
      recipient: { kind: "landlord", id: ownerId },
      idempotencyKey: digestKey(ownerId, today),
    });
    if (r.status === "sent") s.digests++;
    tally(r, `digest ${ownerId}`);
  }
  return s;
}
