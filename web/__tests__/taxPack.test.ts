import { describe, expect, it } from "vitest";
import {
  ANEJO_N_REVIEWED,
  EXPENSE_CATEGORIES,
  SCHEDULE_E_LINES,
  TAX_MAPPING,
  mappingFor,
} from "@/lib/tax/mapping";
import {
  billStatus,
  estimateCrim,
  findRate,
  fiscalYearOf,
  normalizeMunicipality,
  recentFiscalYears,
  upcomingBills,
} from "@/lib/tax/crim";
import { buildAnnualPackage, depreciationForYear, groupLines, leaseMonthsInYear, packageToCsv, type AnnualInput } from "@/lib/tax/annual";

describe("tax mapping", () => {
  it("maps every expense category to an official Schedule E line 5–19", () => {
    for (const c of EXPENSE_CATEGORIES) {
      const line = TAX_MAPPING[c].scheduleE;
      expect(line).toBeGreaterThanOrEqual(5);
      expect(line).toBeLessThanOrEqual(19);
      expect(SCHEDULE_E_LINES[line]).toBeTruthy();
    }
  });

  it("uses the official Schedule E names", () => {
    expect(SCHEDULE_E_LINES[7]).toBe("Cleaning and maintenance");
    expect(SCHEDULE_E_LINES[12]).toBe("Mortgage interest paid to banks, etc.");
    expect(SCHEDULE_E_LINES[18]).toBe("Depreciation expense or depletion");
    expect(Object.keys(SCHEDULE_E_LINES).map(Number)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(TAX_MAPPING.taxes.scheduleE).toBe(16);
    expect(TAX_MAPPING.repairs.scheduleE).toBe(14);
  });

  it("keeps the Anejo N side descriptive and unreviewed", () => {
    expect(ANEJO_N_REVIEWED).toBe(false);
    for (const c of EXPENSE_CATEGORIES) expect(TAX_MAPPING[c].anejoN.line).toBeNull();
    expect(TAX_MAPPING.repairs.anejoN.key).toBe(TAX_MAPPING.maintenance.anejoN.key);
  });

  it("falls back to Other for unknown categories", () => {
    expect(mappingFor("legacy")).toBe(TAX_MAPPING.other);
  });
});

describe("CRIM helpers", () => {
  it("normalizes municipality names without accents", () => {
    expect(normalizeMunicipality("Bayamón")).toBe("bayamon");
    expect(normalizeMunicipality("  LOÍZA ")).toBe("loiza");
    expect(normalizeMunicipality("Juana Díaz")).toBe(normalizeMunicipality("Juana Diaz"));
    expect(normalizeMunicipality(null)).toBe("");
  });

  it("computes the PR fiscal year (July–June)", () => {
    expect(fiscalYearOf("2026-10-08")).toBe("2026-27");
    expect(fiscalYearOf("2026-06-30")).toBe("2025-26");
    expect(fiscalYearOf("2026-07-01")).toBe("2026-27");
    expect(fiscalYearOf("2099-12-01")).toBe("2099-00");
    expect(recentFiscalYears("2026-10-08", 3)).toEqual(["2027-28", "2026-27", "2025-26"]);
  });

  const rates = [
    { municipality: "Bayamón", fiscal_year: "2025-2026", inmueble_rate: 9.58 },
    { municipality: "Bayamón", fiscal_year: "2026-2027", inmueble_rate: 9.6 },
    { municipality: "Juana Diaz", fiscal_year: "2026-2027", inmueble_rate: 9.33 },
  ];

  it("matches the rate accent-insensitively and prefers the fiscal year", () => {
    expect(findRate(rates, "bayamon", "2025-26")?.ratePct).toBe(9.58);
    expect(findRate(rates, "BAYAMÓN", "2026-27")?.ratePct).toBe(9.6);
    expect(findRate(rates, "Bayamon")?.fiscalYear).toBe("2026-2027");
    expect(findRate(rates, "Juana Díaz", "2030-31")?.ratePct).toBe(9.33);
    expect(findRate(rates, "Ponce")).toBeNull();
    expect(findRate(rates, "")).toBeNull();
  });

  it("estimates assessed × rate minus the exoneration", () => {
    expect(estimateCrim({ assessedValue: 40000, exoneration: 15000, ratePct: 10.33 })).toEqual({ taxable: 25000, annual: 2582.5 });
    expect(estimateCrim({ assessedValue: 10000, exoneration: 15000, ratePct: 10 })).toEqual({ taxable: 0, annual: 0 });
    expect(estimateCrim({ assessedValue: null, ratePct: 10 })).toBeNull();
    expect(estimateCrim({ assessedValue: 1000, ratePct: null })).toBeNull();
  });

  const bill = (id: string, due: string, extra: Partial<{ paid_on: string; voided_at: string }> = {}) => ({
    id, property_id: "p", fiscal_year: "2026-27", installment: 1, amount: 100, due_date: due, paid_on: null, voided_at: null, ...extra,
  });

  it("classifies bills", () => {
    expect(billStatus(bill("a", "2026-10-01"), "2026-10-08")).toBe("overdue");
    expect(billStatus(bill("a", "2026-10-08"), "2026-10-08")).toBe("due");
    expect(billStatus(bill("a", "2026-10-01", { paid_on: "2026-09-30" }), "2026-10-08")).toBe("paid");
    expect(billStatus(bill("a", "2026-10-01", { voided_at: "x" }), "2026-10-08")).toBe("voided");
  });

  it("lists unpaid bills due in the next 30 days, soonest first", () => {
    const list = upcomingBills(
      [
        bill("late", "2026-10-01"),
        bill("b", "2026-11-07"),
        bill("a", "2026-10-20"),
        bill("far", "2026-11-08"),
        bill("paid", "2026-10-15", { paid_on: "2026-10-02" }),
        bill("void", "2026-10-15", { voided_at: "x" }),
      ],
      "2026-10-08"
    );
    expect(list.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("annual package", () => {
  it("counts lease months that touch the year", () => {
    expect(leaseMonthsInYear("2025-03-01", "2027-02-28", 2026)).toBe(12);
    expect(leaseMonthsInYear("2026-07-01", "2027-06-30", 2026)).toBe(6);
    expect(leaseMonthsInYear("2024-01-01", "2024-12-31", 2026)).toBe(0);
  });

  it("depreciates 27.5 years with the mid-month convention", () => {
    // $275,000 placed in service in January: 11.5 months the first year.
    expect(depreciationForYear(275000, "2026-01-15", 2026)).toBe(9583.33);
    expect(depreciationForYear(275000, "2026-01-15", 2027)).toBe(10000);
    expect(depreciationForYear(275000, "2026-01-15", 2025)).toBe(0);
    // The 28th year takes the remainder, then nothing.
    expect(depreciationForYear(275000, "2026-01-15", 2053)).toBe(5416.67);
    expect(depreciationForYear(275000, "2026-01-15", 2054)).toBe(0);
  });

  const base: AnnualInput = {
    year: 2026,
    properties: [
      { id: "p1", name: "Las Palmas", address: "Calle 1", city: "San Juan" },
      { id: "p2", name: "Dorado", address: null, city: null },
    ],
    contracts: [
      { id: "c1", property_id: "p1", status: "signed", rent_amount: 1000, lease_start: "2025-01-01", lease_end: "2026-12-31" },
      { id: "c2", property_id: "p2", status: "signed", rent_amount: 2000, lease_start: "2026-07-01", lease_end: "2027-06-30" },
      { id: "c3", property_id: "p2", status: "draft", rent_amount: 9999, lease_start: "2026-01-01", lease_end: "2026-12-31" },
    ],
    ledgerContractIds: ["c1"],
    payments: [
      { contract_id: "c1", amount: 1000, received_on: "2026-01-03", voided_at: null },
      { contract_id: "c1", amount: 1000, received_on: "2026-02-03", voided_at: null },
      { contract_id: "c1", amount: 1000, received_on: "2026-03-03", voided_at: "2026-03-04" },
      { contract_id: "c1", amount: 1000, received_on: "2025-12-03", voided_at: null },
    ],
    expenses: [
      { property_id: "p1", category: "repairs", amount: 100, expense_date: "2026-02-01" },
      { property_id: "p1", category: "maintenance", amount: 50, expense_date: "2026-03-01" },
      { property_id: "p1", category: "taxes", amount: 300, expense_date: "2026-07-15" },
      { property_id: "p1", category: "insurance", amount: 400, expense_date: "2025-07-15" },
      { property_id: "p2", category: "weird", amount: 25, expense_date: "2026-05-01" },
    ],
    crimBills: [
      { property_id: "p1", amount: 300, paid_on: "2026-07-15", expense_id: "e-linked", voided_at: null },
      { property_id: "p1", amount: 200, paid_on: "2026-01-10", expense_id: null, voided_at: null },
      { property_id: "p1", amount: 999, paid_on: "2026-01-10", expense_id: null, voided_at: "2026-01-11" },
      { property_id: "p1", amount: 250, paid_on: null, expense_id: null, voided_at: null },
    ],
    taxInputs: [{ property_id: "p1", purchase_price: 200000, building_pct: 80, placed_in_service: "2020-06-01" }],
  };

  it("uses ledger payments as cash income and estimates leases without a ledger", () => {
    const pkg = buildAnnualPackage(base);
    const [p1, p2] = pkg.properties;
    expect(p1.incomeSource).toBe("ledger");
    expect(p1.income).toBe(2000);
    expect(p2.incomeSource).toBe("estimate");
    expect(p2.income).toBe(12000);
    expect(p2.lines.find((l) => l.kind === "income_estimate")?.estimated).toBe(true);
    expect(pkg.hasEstimates).toBe(true);
  });

  it("adds CRIM paid without a linked expense once, and keeps the linked one in expenses", () => {
    const p1 = buildAnnualPackage(base).properties[0];
    expect(p1.crimPaid).toBe(500);
    expect(p1.lines.find((l) => l.kind === "crim_unlinked")?.amount).toBe(200);
    // repairs 100 + maintenance 50 + taxes 300 + CRIM 200
    expect(p1.expenses).toBe(650);
    expect(p1.net).toBe(1350);
  });

  it("computes depreciation from the building share", () => {
    const p1 = buildAnnualPackage(base).properties[0];
    expect(p1.depreciation?.basis).toBe(160000);
    expect(p1.depreciation?.annual).toBe(5818.18);
    expect(p1.netAfterDepreciation).toBe(1350 - 5818.18);
  });

  it("puts unknown categories under Other", () => {
    const p2 = buildAnnualPackage(base).properties[1];
    expect(p2.lines.find((l) => l.kind === "expense")?.category).toBe("other");
  });

  it("groups by Schedule E line or by Anejo N group", () => {
    const p1 = buildAnnualPackage(base).properties[0];
    const se = groupLines(p1.lines, "schedule_e");
    expect(se.map((g) => g.key)).toEqual(["3", "7", "14", "16", "18"]);
    expect(se.find((g) => g.key === "16")?.amount).toBe(500);
    const an = groupLines(p1.lines, "anejo_n");
    expect(an.find((g) => g.key === "repairsMaintenance")?.amount).toBe(150);
    expect(an.at(-1)?.key).toBe("depreciation");
  });

  it("exports one CSV row per line item with a BOM", () => {
    const pkg = buildAnnualPackage(base);
    const csv = packageToCsv(pkg, {
      header: ["year", "property", "kind", "category", "line", "name", "anejo", "review", "amount", "estimated"],
      lineKind: (k) => k,
      category: (c) => c,
      anejoN: (k) => k,
      yes: "sí",
      no: "no",
      pendingReview: "Pendiente de revisión por un CPA",
    });
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + pkg.properties.reduce((s, p) => s + p.lines.length, 0));
    expect(lines[1]).toBe("2026,Las Palmas,income_ledger,,3,Rents received,grossRent,Pendiente de revisión por un CPA,2000,no");
  });

  it("neutralizes spreadsheet formulas in names", () => {
    const pkg = buildAnnualPackage({ ...base, properties: [{ id: "p1", name: "=HYPERLINK(1)" }] });
    const csv = packageToCsv(pkg, {
      header: ["h"], lineKind: (k) => k, category: (c) => c, anejoN: (k) => k, yes: "y", no: "n", pendingReview: "r",
    });
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
