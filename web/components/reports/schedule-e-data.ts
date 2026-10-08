import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { ledgerIncomeByProperty } from "@/lib/tax/load";
import { TAX_MAPPING } from "@/lib/tax/mapping";

/** Expense category -> Schedule E line, from the shared tax mapping (PDF and screen agree). */
export const SCHEDULE_E_LINE_BY_CATEGORY: Record<string, number> = Object.fromEntries(
  Object.entries(TAX_MAPPING).map(([category, m]) => [category, m.scheduleE])
);

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
  supabase: SupabaseClient<Database>,
  userId: string,
  year: number
): Promise<ScheduleESummary> {
  const [{ data: properties }, { data: expenses }, { data: contracts }, ledger] = await Promise.all([
    supabase.from("properties").select("id, name, address, city").eq("owner_id", userId).order("name"),
    supabase
      .from("property_expenses")
      .select("property_id, category, amount")
      .eq("user_id", userId)
      .gte("expense_date", `${year}-01-01`)
      .lte("expense_date", `${year}-12-31`),
    supabase
      .from("contracts")
      .select("id, property_id, rent_amount, lease_start, lease_end")
      .eq("owner_id", userId)
      .eq("status", "signed"),
    // Plan 35: leases with a rent ledger report cash received instead of an estimate.
    ledgerIncomeByProperty(supabase, userId, year),
  ]);

  const yearStart = new Date(`${year}-01-01`).getTime();
  const yearEnd = new Date(`${year}-12-31`).getTime();

  const rows: ScheduleEProperty[] = (properties ?? []).map((p) => {
    let income = ledger.income.get(p.id) ?? 0;
    (contracts ?? [])
      .filter((c) => c.property_id === p.id && c.lease_start && c.lease_end && !ledger.ledgerContracts.has(c.id))
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
