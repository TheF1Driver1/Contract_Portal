/**
 * Expense category → tax form line, for the year-end package (Plan 35).
 *
 * Schedule E (IRS Form 1040, Part I) line numbers and names are the official
 * ones for lines 5–19. The Anejo N side (Hacienda, Planilla de Contribución
 * sobre Ingresos de Individuos) is a descriptive grouping only: it has NOT been
 * reviewed by a CPA, so it carries `reviewed: false`, `line: null`, and every
 * screen or export that uses it shows "Pendiente de revisión por un CPA".
 */
import type { PropertyExpense } from "@/lib/types";

export type ExpenseCategory = PropertyExpense["category"];

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "advertising",
  "maintenance",
  "insurance",
  "management",
  "mortgage",
  "repairs",
  "taxes",
  "utilities",
  "hoa",
  "other",
] as const;

/** IRS Schedule E, Part I, expense lines 5–19 (official names). */
export const SCHEDULE_E_LINES = {
  5: "Advertising",
  6: "Auto and travel",
  7: "Cleaning and maintenance",
  8: "Commissions",
  9: "Insurance",
  10: "Legal and other professional fees",
  11: "Management fees",
  12: "Mortgage interest paid to banks, etc.",
  13: "Other interest",
  14: "Repairs",
  15: "Supplies",
  16: "Taxes",
  17: "Utilities",
  18: "Depreciation expense or depletion",
  19: "Other (list)",
} as const satisfies Record<number, string>;

export type ScheduleELine = keyof typeof SCHEDULE_E_LINES;

/** Schedule E line 3: rents received. */
export const SCHEDULE_E_RENTS_LINE = 3;
export const SCHEDULE_E_DEPRECIATION_LINE: ScheduleELine = 18;

/**
 * Anejo N groups. `key` selects the label in messages/<locale>/tax.json
 * (`anejoN.<key>`); `line` stays null until a CPA confirms the exact line.
 */
export type AnejoNGroup = { key: AnejoNKey; line: number | null };
export type AnejoNKey =
  | "grossRent"
  | "repairsMaintenance"
  | "utilities"
  | "insurance"
  | "propertyTax"
  | "hoa"
  | "management"
  | "advertising"
  | "mortgageInterest"
  | "depreciation"
  | "other";

/** The Anejo N mapping as a whole is pending professional review. */
export const ANEJO_N_REVIEWED = false as const;

export type CategoryMapping = {
  scheduleE: ScheduleELine;
  anejoN: AnejoNGroup;
};

export const TAX_MAPPING: Record<ExpenseCategory, CategoryMapping> = {
  advertising: { scheduleE: 5, anejoN: { key: "advertising", line: null } },
  maintenance: { scheduleE: 7, anejoN: { key: "repairsMaintenance", line: null } },
  insurance: { scheduleE: 9, anejoN: { key: "insurance", line: null } },
  management: { scheduleE: 11, anejoN: { key: "management", line: null } },
  mortgage: { scheduleE: 12, anejoN: { key: "mortgageInterest", line: null } },
  repairs: { scheduleE: 14, anejoN: { key: "repairsMaintenance", line: null } },
  taxes: { scheduleE: 16, anejoN: { key: "propertyTax", line: null } },
  utilities: { scheduleE: 17, anejoN: { key: "utilities", line: null } },
  hoa: { scheduleE: 19, anejoN: { key: "hoa", line: null } },
  other: { scheduleE: 19, anejoN: { key: "other", line: null } },
};

export const ANEJO_N_INCOME: AnejoNGroup = { key: "grossRent", line: null };
export const ANEJO_N_DEPRECIATION: AnejoNGroup = { key: "depreciation", line: null };

/** Unknown categories (old rows, typos) fall into "Other". */
export function mappingFor(category: string): CategoryMapping {
  return (TAX_MAPPING as Record<string, CategoryMapping>)[category] ?? TAX_MAPPING.other;
}

export function isExpenseCategory(c: string): c is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}
