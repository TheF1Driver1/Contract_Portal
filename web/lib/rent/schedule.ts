// Rent ledger rules (Plan 33). Pure functions so the daily job, the UI and
// tests agree on what is owed.
//
// - One rent charge per month, due on the lease's payment day (clamped to the
//   month's last day), posted 5 days ahead so tenants see it coming.
// - Payments cover rent first (oldest month first), then fees.
// - A month is late when its rent is not fully covered by the end of the
//   grace period. The late fee follows the lease: a fixed amount, a daily
//   amount, or both. Daily accrual stops when the rent is covered or the next
//   month comes due, so a fee never snowballs across months.

export type LateFeeType = "fixed" | "daily" | "both";

export type LedgerContract = {
  id: string;
  owner_id: string;
  rent_amount: number;
  payment_due_day: number;
  lease_start: string; // YYYY-MM-DD
  lease_end: string;
  late_fee_type: LateFeeType;
  late_fee_grace_period_days: number;
  late_fee_fixed_amount: number;
  late_fee_daily_amount: number;
};

export type Charge = {
  kind: "rent" | "late_fee" | "other";
  period: string | null; // first day of the month for rent and late fees
  due_date: string;
  amount: number;
  voided?: boolean;
};

export type Payment = { amount: number; received_on: string; voided?: boolean };

export type ChargeUpsert = { kind: "rent" | "late_fee"; period: string; due_date: string; amount: number };

export const POST_AHEAD_DAYS = 5;

const DAY = 86_400_000;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
const cents = (n: number) => Math.round(n * 100) / 100;

export function monthStart(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

function nextMonth(period: string): string {
  const d = toDate(period);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

export function dueDateFor(period: string, dueDay: number): string {
  const d = toDate(period);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(Math.max(dueDay, 1), last))));
}

/** Rent periods from the ledger start through `until`, inside the lease term. */
export function rentPeriods(c: LedgerContract, startedOn: string, until: string): { period: string; due_date: string }[] {
  const out: { period: string; due_date: string }[] = [];
  const from = startedOn > c.lease_start ? startedOn : c.lease_start;
  const horizon = addDays(until, POST_AHEAD_DAYS);
  for (let p = monthStart(from); p <= horizon; p = nextMonth(p)) {
    const due = dueDateFor(p, c.payment_due_day);
    if (due < from || due > c.lease_end) continue;
    if (due > horizon) break;
    out.push({ period: p, due_date: due });
  }
  return out;
}

/**
 * The date each rent charge became fully covered (payments apply to rent
 * first, oldest month first), or null if it is still open.
 */
export function rentCoverage(charges: Charge[], payments: Payment[]): Map<string, string | null> {
  const rent = charges.filter((c) => c.kind === "rent" && !c.voided && c.period).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = payments.filter((p) => !p.voided).sort((a, b) => a.received_on.localeCompare(b.received_on));
  const covered = new Map<string, string | null>();
  let owed = 0;
  let i = 0;
  let total = 0;
  for (const r of rent) {
    owed = cents(owed + r.amount);
    while (total + 0.004 < owed && i < paid.length) total = cents(total + paid[i++].amount);
    covered.set(r.period!, total + 0.004 >= owed ? paid[Math.max(i - 1, 0)]?.received_on ?? null : null);
  }
  return covered;
}

/** Late fee for one month as of `today` (0 when not late or the lease has no fee). */
export function lateFeeFor(c: LedgerContract, dueDate: string, coveredOn: string | null, today: string): number {
  if (c.late_fee_type === "fixed" && !c.late_fee_fixed_amount) return 0;
  const lateFrom = addDays(dueDate, c.late_fee_grace_period_days);
  // Covered by the end of grace (or not yet past it): no fee.
  if ((coveredOn && coveredOn <= lateFrom) || today <= lateFrom) return 0;
  const nextDue = dueDateFor(nextMonth(monthStart(dueDate)), c.payment_due_day);
  const stop = [coveredOn ?? today, today, nextDue].sort()[0];
  const daysLate = Math.max(daysBetween(lateFrom, stop), 0);
  let fee = 0;
  if (c.late_fee_type === "fixed" || c.late_fee_type === "both") fee += c.late_fee_fixed_amount;
  if (c.late_fee_type === "daily" || c.late_fee_type === "both") fee += c.late_fee_daily_amount * daysLate;
  return cents(fee);
}

/**
 * Charges the daily job should create or raise for one contract. Existing
 * rent charges are never changed; late fees only go up (a landlord can void one).
 */
export function chargesToPost(c: LedgerContract, startedOn: string, today: string, charges: Charge[], payments: Payment[]): ChargeUpsert[] {
  const out: ChargeUpsert[] = [];
  const existing = new Map(charges.filter((x) => x.period).map((x) => [`${x.kind}:${x.period}`, x]));
  const all = [...charges];
  for (const p of rentPeriods(c, startedOn, today)) {
    if (!existing.has(`rent:${p.period}`)) {
      const ch = { kind: "rent" as const, period: p.period, due_date: p.due_date, amount: cents(c.rent_amount) };
      out.push(ch);
      all.push(ch);
    }
  }
  const coverage = rentCoverage(all, payments);
  for (const r of all.filter((x) => x.kind === "rent" && !x.voided && x.period)) {
    const fee = lateFeeFor(c, r.due_date, coverage.get(r.period!) ?? null, today);
    const prev = existing.get(`late_fee:${r.period}`);
    if (prev?.voided) continue;
    if (fee > 0 && (!prev || fee > prev.amount)) {
      out.push({ kind: "late_fee", period: r.period!, due_date: addDays(r.due_date, c.late_fee_grace_period_days + 1), amount: fee });
    }
  }
  return out;
}

export type LedgerSummary = { charged: number; paid: number; balance: number; overdue: number; nextDue: { date: string; amount: number } | null };

/** Balance, the overdue part (past-due charges not yet covered) and the next due charge. */
export function summarize(charges: Charge[], payments: Payment[], today: string): LedgerSummary {
  const live = charges.filter((c) => !c.voided);
  const charged = cents(live.reduce((s, c) => s + c.amount, 0));
  const paid = cents(payments.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0));
  const pastDue = cents(live.filter((c) => c.due_date < today).reduce((s, c) => s + c.amount, 0));
  const upcoming = live.filter((c) => c.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  return {
    charged,
    paid,
    balance: cents(charged - paid),
    overdue: Math.max(cents(pastDue - paid), 0),
    nextDue: upcoming ? { date: upcoming.due_date, amount: upcoming.amount } : null,
  };
}
