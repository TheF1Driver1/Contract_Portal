/**
 * Year-end tax package (Plan 35): pure math, no I/O. The loader in
 * `lib/tax/load.ts` feeds it rows; the page, CSV and PDF render its output.
 *
 * Income is cash basis: ledger payments received in the year. Leases without
 * a rent ledger fall back to signed-lease rent × months, flagged as estimated.
 */
import {
  ANEJO_N_DEPRECIATION,
  ANEJO_N_INCOME,
  EXPENSE_CATEGORIES,
  SCHEDULE_E_DEPRECIATION_LINE,
  SCHEDULE_E_LINES,
  SCHEDULE_E_RENTS_LINE,
  mappingFor,
  type AnejoNKey,
  type ExpenseCategory,
} from "@/lib/tax/mapping";

export type TaxView = "anejo_n" | "schedule_e";

export type AnnualInput = {
  year: number;
  properties: { id: string; name: string; address?: string | null; city?: string | null }[];
  /** Every lease of these properties (any status), to map payments to a property. */
  contracts: { id: string; property_id: string; status: string; rent_amount: number | null; lease_start: string | null; lease_end: string | null }[];
  /** Contracts that have a rent ledger. */
  ledgerContractIds: Iterable<string>;
  payments: { contract_id: string; amount: number; received_on: string; voided_at: string | null }[];
  expenses: { property_id: string; category: string; amount: number; expense_date: string }[];
  crimBills: { property_id: string; amount: number; paid_on: string | null; expense_id: string | null; voided_at: string | null }[];
  taxInputs: { property_id: string; purchase_price: number | null; building_pct: number | null; placed_in_service: string | null }[];
};

export type LineKind = "income_ledger" | "income_estimate" | "expense" | "crim_unlinked" | "depreciation";

export type AnnualLine = {
  kind: LineKind;
  /** Expense category for expense lines; "taxes" for CRIM. */
  category: ExpenseCategory | null;
  scheduleE: number;
  anejoN: AnejoNKey;
  amount: number;
  estimated: boolean;
};

export type Depreciation = {
  purchasePrice: number;
  buildingPct: number;
  placedInService: string;
  basis: number;
  /** Straight-line 27.5 years, mid-month convention (IRS reference). */
  annual: number;
};

export type AnnualProperty = {
  id: string;
  name: string;
  address: string | null;
  incomeSource: "ledger" | "estimate" | "mixed" | "none";
  income: number;
  lines: AnnualLine[];
  /** Expenses incl. CRIM paid without a linked expense; excludes depreciation. */
  expenses: number;
  /** All CRIM bills paid in the year (informational; already inside `expenses`). */
  crimPaid: number;
  net: number;
  depreciation: Depreciation | null;
  netAfterDepreciation: number;
};

export type AnnualPackage = {
  year: number;
  properties: AnnualProperty[];
  income: number;
  expenses: number;
  crimPaid: number;
  depreciation: number;
  net: number;
  netAfterDepreciation: number;
  hasEstimates: boolean;
};

const cents = (n: number) => Math.round(n * 100) / 100;
const inYear = (d: string | null | undefined, year: number) => !!d && d.slice(0, 4) === String(year);

/** Same month count as the Schedule E summary: months of the lease that touch the year. */
export function leaseMonthsInYear(leaseStart: string, leaseEnd: string, year: number): number {
  const yearStart = new Date(`${year}-01-01`).getTime();
  const yearEnd = new Date(`${year}-12-31`).getTime();
  const start = new Date(Math.max(new Date(leaseStart).getTime(), yearStart));
  const end = new Date(Math.min(new Date(leaseEnd).getTime(), yearEnd));
  if (!(end > start)) return 0;
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.min(Math.max(months, 0), 12);
}

const RESIDENTIAL_LIFE_YEARS = 27.5;

/**
 * Straight-line depreciation for residential rental property, 27.5 years with
 * the mid-month convention (IRS reference only; Puerto Rico rules may differ).
 */
export function depreciationForYear(basis: number, placedInService: string, year: number, lifeYears = RESIDENTIAL_LIFE_YEARS): number {
  if (!(basis > 0)) return 0;
  const y0 = Number(placedInService.slice(0, 4));
  const m0 = Number(placedInService.slice(5, 7));
  if (!y0 || !m0 || year < y0) return 0;
  const perYear = basis / lifeYears;
  const firstYear = (perYear * (12 - m0 + 0.5)) / 12;
  const prior = year === y0 ? 0 : firstYear + perYear * (year - y0 - 1);
  const remaining = Math.max(0, basis - prior);
  return cents(Math.min(year === y0 ? firstYear : perYear, remaining));
}

export function buildAnnualPackage(input: AnnualInput): AnnualPackage {
  const { year } = input;
  const ledger = new Set(input.ledgerContractIds);
  const contractProperty = new Map(input.contracts.map((c) => [c.id, c.property_id]));

  const rows: AnnualProperty[] = input.properties.map((p) => {
    const leases = input.contracts.filter((c) => c.property_id === p.id);
    const ledgerLeases = leases.filter((c) => ledger.has(c.id));
    const ledgerIds = new Set(ledgerLeases.map((c) => c.id));

    const ledgerIncome = cents(
      input.payments
        .filter((x) => !x.voided_at && ledgerIds.has(x.contract_id) && contractProperty.get(x.contract_id) === p.id && inYear(x.received_on, year))
        .reduce((s, x) => s + Number(x.amount), 0)
    );
    const estimate = cents(
      leases
        .filter((c) => !ledgerIds.has(c.id) && c.status === "signed" && c.lease_start && c.lease_end)
        .reduce((s, c) => s + Number(c.rent_amount ?? 0) * leaseMonthsInYear(c.lease_start!, c.lease_end!, year), 0)
    );

    const lines: AnnualLine[] = [];
    if (ledgerLeases.length > 0) {
      lines.push({ kind: "income_ledger", category: null, scheduleE: SCHEDULE_E_RENTS_LINE, anejoN: ANEJO_N_INCOME.key, amount: ledgerIncome, estimated: false });
    }
    if (estimate > 0) {
      lines.push({ kind: "income_estimate", category: null, scheduleE: SCHEDULE_E_RENTS_LINE, anejoN: ANEJO_N_INCOME.key, amount: estimate, estimated: true });
    }

    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of input.expenses) {
      if (e.property_id !== p.id || !inYear(e.expense_date, year)) continue;
      const cat = (EXPENSE_CATEGORIES as readonly string[]).includes(e.category) ? (e.category as ExpenseCategory) : "other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(e.amount));
    }
    for (const cat of EXPENSE_CATEGORIES) {
      const amount = byCategory.get(cat);
      if (!amount) continue;
      const m = mappingFor(cat);
      lines.push({ kind: "expense", category: cat, scheduleE: m.scheduleE, anejoN: m.anejoN.key, amount: cents(amount), estimated: false });
    }

    const paidBills = input.crimBills.filter((b) => b.property_id === p.id && !b.voided_at && inYear(b.paid_on, year));
    const crimPaid = cents(paidBills.reduce((s, b) => s + Number(b.amount), 0));
    // Bills marked paid with "create expense" are already in property_expenses.
    const crimUnlinked = cents(paidBills.filter((b) => !b.expense_id).reduce((s, b) => s + Number(b.amount), 0));
    if (crimUnlinked > 0) {
      const m = mappingFor("taxes");
      lines.push({ kind: "crim_unlinked", category: "taxes", scheduleE: m.scheduleE, anejoN: m.anejoN.key, amount: crimUnlinked, estimated: false });
    }

    let depreciation: Depreciation | null = null;
    const ti = input.taxInputs.find((x) => x.property_id === p.id);
    if (ti && Number(ti.purchase_price) > 0 && ti.building_pct != null && ti.placed_in_service) {
      const basis = cents((Number(ti.purchase_price) * Number(ti.building_pct)) / 100);
      depreciation = {
        purchasePrice: Number(ti.purchase_price),
        buildingPct: Number(ti.building_pct),
        placedInService: ti.placed_in_service,
        basis,
        annual: depreciationForYear(basis, ti.placed_in_service, year),
      };
      if (depreciation.annual > 0) {
        lines.push({ kind: "depreciation", category: null, scheduleE: SCHEDULE_E_DEPRECIATION_LINE, anejoN: ANEJO_N_DEPRECIATION.key, amount: depreciation.annual, estimated: true });
      }
    }

    const income = cents(ledgerIncome + estimate);
    const expenses = cents(lines.filter((l) => l.kind === "expense" || l.kind === "crim_unlinked").reduce((s, l) => s + l.amount, 0));
    const net = cents(income - expenses);
    const incomeSource: AnnualProperty["incomeSource"] =
      ledgerLeases.length > 0 && estimate > 0 ? "mixed" : ledgerLeases.length > 0 ? "ledger" : estimate > 0 ? "estimate" : "none";
    const address = [p.address, p.city].filter(Boolean).join(", ") || null;
    return {
      id: p.id,
      name: p.name,
      address,
      incomeSource,
      income,
      lines,
      expenses,
      crimPaid,
      net,
      depreciation,
      netAfterDepreciation: cents(net - (depreciation?.annual ?? 0)),
    };
  });

  const sum = (f: (r: AnnualProperty) => number) => cents(rows.reduce((s, r) => s + f(r), 0));
  return {
    year,
    properties: rows,
    income: sum((r) => r.income),
    expenses: sum((r) => r.expenses),
    crimPaid: sum((r) => r.crimPaid),
    depreciation: sum((r) => r.depreciation?.annual ?? 0),
    net: sum((r) => r.net),
    netAfterDepreciation: sum((r) => r.netAfterDepreciation),
    hasEstimates: rows.some((r) => r.lines.some((l) => l.estimated)),
  };
}

export type GroupedLine = {
  /** Schedule E line number or Anejo N group key, depending on the view. */
  key: string;
  scheduleE: number;
  anejoN: AnejoNKey;
  kind: "income" | "expense" | "depreciation";
  amount: number;
  estimated: boolean;
};

/** Lines summed per form line for the chosen view, in form order. */
export function groupLines(lines: AnnualLine[], view: TaxView): GroupedLine[] {
  const out = new Map<string, GroupedLine>();
  for (const l of lines) {
    const kind = l.kind.startsWith("income") ? "income" : l.kind === "depreciation" ? "depreciation" : "expense";
    const key = view === "schedule_e" ? String(l.scheduleE) : l.anejoN;
    const prev = out.get(key);
    if (prev) {
      prev.amount = cents(prev.amount + l.amount);
      prev.estimated ||= l.estimated;
    } else {
      out.set(key, { key, scheduleE: l.scheduleE, anejoN: l.anejoN, kind, amount: l.amount, estimated: l.estimated });
    }
  }
  const rank = (g: GroupedLine) => (g.kind === "income" ? 0 : g.kind === "depreciation" ? 2 : 1);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || a.scheduleE - b.scheduleE);
}

export const scheduleELineName = (line: number) =>
  line === SCHEDULE_E_RENTS_LINE ? "Rents received" : (SCHEDULE_E_LINES as Record<number, string>)[line] ?? "";

// ── CSV ──────────────────────────────────────────────────────────────────────

export type CsvLabels = {
  header: string[];
  lineKind: (k: LineKind) => string;
  category: (c: ExpenseCategory) => string;
  anejoN: (k: AnejoNKey) => string;
  yes: string;
  no: string;
  pendingReview: string;
};

const csvCell = (v: string | number) => {
  const s = String(v);
  // Neutralize spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One row per line item, every property; UTF-8 with BOM for Excel. */
export function packageToCsv(pkg: AnnualPackage, labels: CsvLabels): string {
  const rows: (string | number)[][] = [labels.header];
  for (const p of pkg.properties) {
    for (const l of p.lines) {
      rows.push([
        pkg.year,
        p.name,
        labels.lineKind(l.kind),
        l.category ? labels.category(l.category) : "",
        l.scheduleE,
        scheduleELineName(l.scheduleE),
        labels.anejoN(l.anejoN),
        labels.pendingReview,
        l.amount,
        l.estimated ? labels.yes : labels.no,
      ]);
    }
  }
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
