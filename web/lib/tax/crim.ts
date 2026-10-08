/**
 * CRIM (Centro de Recaudación de Ingresos Municipales) helpers. Pure functions;
 * the estimate is informational only and is always labeled "Estimado".
 */

export type CrimRate = {
  municipality: string | null;
  fiscal_year: string | null;
  inmueble_rate: number | null;
};

export type MatchedRate = { municipality: string; fiscalYear: string; ratePct: number };

export type BillLike = {
  id: string;
  property_id: string;
  fiscal_year: string;
  installment: number;
  amount: number;
  due_date: string;
  paid_on: string | null;
  voided_at: string | null;
};

export type BillStatus = "paid" | "overdue" | "due" | "voided";

/** "Bayamón", "BAYAMON ", "bayamon" → "bayamon" (accents and case ignored). */
export function normalizeMunicipality(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Puerto Rico's fiscal year runs July 1 – June 30: 2026-10-08 → "2026-27". */
export function fiscalYearOf(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** First year of a fiscal year label, from "2026-27" or "2026-2027". */
function fyStart(label: string | null | undefined): number | null {
  const m = /^(\d{4})-\d{2,4}$/.exec(label ?? "");
  return m ? Number(m[1]) : null;
}

/** Recent fiscal years for pickers, newest first. */
export function recentFiscalYears(today: string, count = 4): string[] {
  const start = fyStart(fiscalYearOf(today))!;
  return Array.from({ length: count }, (_, i) => {
    const s = start + 1 - i;
    return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
  });
}

/**
 * Real-property (inmueble) rate for a municipality, matched without accents.
 * Prefers the requested fiscal year, else the most recent one on file.
 */
export function findRate(rates: CrimRate[], municipality: string | null | undefined, fiscalYear?: string): MatchedRate | null {
  const needle = normalizeMunicipality(municipality);
  if (!needle) return null;
  const want = fyStart(fiscalYear);
  const candidates = rates
    .filter((r) => r.inmueble_rate != null && normalizeMunicipality(r.municipality) === needle)
    .sort((a, b) => (fyStart(b.fiscal_year) ?? 0) - (fyStart(a.fiscal_year) ?? 0));
  const hit = candidates.find((r) => want != null && fyStart(r.fiscal_year) === want) ?? candidates[0];
  if (!hit) return null;
  return { municipality: hit.municipality ?? "", fiscalYear: hit.fiscal_year ?? "", ratePct: Number(hit.inmueble_rate) };
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Estimated yearly CRIM: (assessed value − exoneration) × rate%.
 * Returns null when the inputs needed are missing.
 */
export function estimateCrim(input: {
  assessedValue: number | null | undefined;
  exoneration?: number | null;
  ratePct: number | null | undefined;
}): { taxable: number; annual: number } | null {
  const assessed = Number(input.assessedValue);
  const rate = Number(input.ratePct);
  if (!(assessed > 0) || !(rate > 0)) return null;
  const taxable = Math.max(0, assessed - Math.max(0, Number(input.exoneration) || 0));
  return { taxable: cents(taxable), annual: cents((taxable * rate) / 100) };
}

export function billStatus(bill: Pick<BillLike, "paid_on" | "voided_at" | "due_date">, today: string): BillStatus {
  if (bill.voided_at) return "voided";
  if (bill.paid_on) return "paid";
  return bill.due_date < today ? "overdue" : "due";
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Unpaid, not voided bills due from today through `days` ahead, soonest first. */
export function upcomingBills<T extends BillLike>(bills: T[], today: string, days = 30): T[] {
  const horizon = addDays(today, days);
  return bills
    .filter((b) => !b.voided_at && !b.paid_on && b.due_date >= today && b.due_date <= horizon)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}
