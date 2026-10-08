import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Expense category -> Schedule E line. Mirrors SCHEDULE_E_LINES in
 * app/api/reports/schedule-e/route.ts so the on-screen summary matches the PDF.
 */
export const SCHEDULE_E_LINE_BY_CATEGORY: Record<string, number> = {
  advertising: 5,
  insurance: 9,
  management: 11,
  mortgage: 12,
  repairs: 14,
  maintenance: 14,
  taxes: 16,
  utilities: 17,
  hoa: 19,
  other: 19,
};

export type ScheduleELine = { line: number; amount: number };

export type ScheduleEProperty = {
  id: string;
  name: string;
  address: string | null;
  income: number;
  expenses: number;
  net: number;
  lines: ScheduleELine[];
};

export type ScheduleESummary = {
  properties: ScheduleEProperty[];
  income: number;
  expenses: number;
  net: number;
};

/** Same income/expense math as the PDF route, read through the RLS-aware client. */
export async function buildScheduleESummary(
  supabase: SupabaseClient,
  userId: string,
  year: number
): Promise<ScheduleESummary> {
  const [{ data: properties }, { data: expenses }, { data: contracts }] = await Promise.all([
    supabase.from("properties").select("id, name, address, city").eq("owner_id", userId).order("name"),
    supabase
      .from("property_expenses")
      .select("property_id, category, amount")
      .eq("user_id", userId)
      .gte("expense_date", `${year}-01-01`)
      .lte("expense_date", `${year}-12-31`),
    supabase
      .from("contracts")
      .select("property_id, rent_amount, lease_start, lease_end")
      .eq("owner_id", userId)
      .eq("status", "signed"),
  ]);

  const yearStart = new Date(`${year}-01-01`).getTime();
  const yearEnd = new Date(`${year}-12-31`).getTime();

  const rows: ScheduleEProperty[] = (properties ?? []).map((p) => {
    let income = 0;
    (contracts ?? [])
      .filter((c) => c.property_id === p.id && c.lease_start && c.lease_end)
      .forEach((c) => {
        const start = new Date(Math.max(new Date(c.lease_start).getTime(), yearStart));
        const end = new Date(Math.min(new Date(c.lease_end).getTime(), yearEnd));
        if (end > start) {
          const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
          income += Number(c.rent_amount ?? 0) * Math.min(months, 12);
        }
      });

    const byLine = new Map<number, number>();
    (expenses ?? [])
      .filter((e) => e.property_id === p.id)
      .forEach((e) => {
        const line = SCHEDULE_E_LINE_BY_CATEGORY[e.category];
        if (!line) return;
        byLine.set(line, (byLine.get(line) ?? 0) + Number(e.amount ?? 0));
      });

    const lines = [...byLine.entries()].sort(([a], [b]) => a - b).map(([line, amount]) => ({ line, amount }));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const address = [p.address, p.city].filter(Boolean).join(", ") || null;
    return { id: p.id, name: p.name, address, income, expenses: total, net: income - total, lines };
  });

  const income = rows.reduce((s, r) => s + r.income, 0);
  const total = rows.reduce((s, r) => s + r.expenses, 0);
  return { properties: rows, income, expenses: total, net: income - total };
}
