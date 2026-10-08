import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Payment, RentCharge, RentLedger } from "@/lib/db";
import { chargesToPost, summarize, type LateFeeType, type LedgerContract } from "@/lib/rent/schedule";

type Client = SupabaseClient<Database>;

/** Today's date in Puerto Rico (rent falls due on local days). */
export function todayPR(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });
}

const LEASE_COLUMNS =
  "id, owner_id, status, rent_amount, payment_due_day, lease_start, lease_end, late_fee_type, late_fee_grace_period_days, late_fee_fixed_amount, late_fee_daily_amount";

type LeaseRow = LedgerContract & { status: string };

function asLease(r: Record<string, unknown>): LeaseRow {
  return {
    id: r.id as string,
    owner_id: r.owner_id as string,
    status: r.status as string,
    rent_amount: Number(r.rent_amount),
    payment_due_day: Number(r.payment_due_day) || 1,
    lease_start: r.lease_start as string,
    lease_end: r.lease_end as string,
    late_fee_type: ((r.late_fee_type as string) ?? "fixed") as LateFeeType,
    late_fee_grace_period_days: Number(r.late_fee_grace_period_days) || 0,
    late_fee_fixed_amount: Number(r.late_fee_fixed_amount) || 0,
    late_fee_daily_amount: Number(r.late_fee_daily_amount) || 0,
  };
}

const toCharge = (c: RentCharge) => ({ kind: c.kind, period: c.period, due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at });
const toPayment = (p: Payment) => ({ amount: Number(p.amount), received_on: p.received_on, voided: !!p.voided_at });

export type LedgerData = {
  ledger: RentLedger | null;
  charges: RentCharge[];
  payments: Payment[];
  summary: ReturnType<typeof summarize>;
};

/** Everything the ledger panel shows for one lease. RLS scopes it to the caller. */
export async function loadLedger(supabase: Client, contractId: string, today = todayPR()): Promise<LedgerData> {
  const [{ data: ledger }, { data: charges }, { data: payments }] = await Promise.all([
    supabase.from("rent_ledgers").select("*").eq("contract_id", contractId).maybeSingle(),
    supabase.from("rent_charges").select("*").eq("contract_id", contractId).order("due_date"),
    supabase.from("payments").select("*").eq("contract_id", contractId).order("received_on"),
  ]);
  const c = (charges ?? []) as RentCharge[];
  const p = (payments ?? []) as Payment[];
  return { ledger: (ledger as RentLedger | null) ?? null, charges: c, payments: p, summary: summarize(c.map(toCharge), p.map(toPayment), today) };
}

/**
 * Posts rent and late fees that are due for one lease (or every lease when
 * `contractId` is omitted). Safe to run repeatedly: rent is inserted once per
 * month (unique index) and a late fee only ever rises.
 */
export async function postDueCharges(admin: Client, today = todayPR(), contractId?: string): Promise<{ leases: number; posted: number; errors: string[] }> {
  let q = admin.from("rent_ledgers").select("*");
  if (contractId) q = q.eq("contract_id", contractId);
  const { data: ledgers, error } = await q;
  if (error) throw new Error(error.message);
  const errors: string[] = [];
  let posted = 0;
  if (!ledgers?.length) return { leases: 0, posted, errors };

  const ids = ledgers.map((l) => l.contract_id);
  const [{ data: leases }, { data: charges }, { data: payments }] = await Promise.all([
    admin.from("contracts").select(LEASE_COLUMNS).in("id", ids),
    admin.from("rent_charges").select("*").in("contract_id", ids),
    admin.from("payments").select("*").in("contract_id", ids),
  ]);
  const byLease = new Map((leases ?? []).map((l) => [l.id as string, asLease(l as Record<string, unknown>)]));

  for (const l of ledgers as RentLedger[]) {
    const lease = byLease.get(l.contract_id);
    // Only signed leases accrue rent; voided or expired ones stop.
    if (!lease || lease.status !== "signed") continue;
    const mine = ((charges ?? []) as RentCharge[]).filter((c) => c.contract_id === l.contract_id);
    const paid = ((payments ?? []) as Payment[]).filter((p) => p.contract_id === l.contract_id);
    const due = chargesToPost(lease, l.started_on, today, mine.map(toCharge), paid.map(toPayment)).filter(
      (c) => c.kind === "rent" || l.late_fees
    );
    for (const c of due) {
      const prev = mine.find((m) => m.kind === c.kind && m.period === c.period);
      const res = prev
        ? await admin.from("rent_charges").update({ amount: c.amount }).eq("id", prev.id).is("voided_at", null)
        : await admin.from("rent_charges").insert({ ...c, contract_id: l.contract_id, owner_id: l.owner_id });
      // 23505: another run inserted the same month first.
      if (res.error && res.error.code !== "23505") errors.push(`${l.contract_id} ${c.kind} ${c.period}: ${res.error.message}`);
      else if (!res.error) posted++;
    }
  }
  return { leases: ledgers.length, posted, errors };
}
