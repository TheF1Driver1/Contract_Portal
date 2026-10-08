// Shared by the expense form (client) and AI receipt extraction (server).
export const EXPENSE_CATEGORIES = [
  "maintenance",
  "utilities",
  "insurance",
  "taxes",
  "hoa",
  "repairs",
  "management",
  "advertising",
  "mortgage",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
