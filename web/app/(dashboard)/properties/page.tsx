import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Property } from "@/lib/types";
import { PropertiesView, type PropertyRow } from "@/components/properties/PropertiesView";
import type { CrimSheetData } from "@/components/tax/CrimSheet";
import type { CrimBill, PropertyCrim } from "@/lib/db";
import { todayPR } from "@/lib/rent/service";

export default async function PropertiesPage(props: {
  searchParams: Promise<{ q?: string; new?: string; import?: string; crim?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const thisYear = new Date().getFullYear().toString();

  const [{ data: properties }, { data: activeContracts }, { data: expenses }] = await Promise.all([
    supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    supabase.from("contracts").select("property_id, rent_amount").eq("owner_id", user.id).eq("status", "signed"),
    supabase
      .from("property_expenses")
      .select("property_id, amount")
      .eq("user_id", user.id)
      .gte("expense_date", `${thisYear}-01-01`)
      .lte("expense_date", `${thisYear}-12-31`),
  ]);

  const all = (properties ?? []) as Property[];

  const incomeByProperty: Record<string, number> = {};
  const leasesByProperty: Record<string, number> = {};
  for (const c of activeContracts ?? []) {
    incomeByProperty[c.property_id] = (incomeByProperty[c.property_id] ?? 0) + c.rent_amount * 12;
    leasesByProperty[c.property_id] = (leasesByProperty[c.property_id] ?? 0) + 1;
  }
  const expenseByProperty: Record<string, number> = {};
  for (const e of expenses ?? []) {
    expenseByProperty[e.property_id] = (expenseByProperty[e.property_id] ?? 0) + e.amount;
  }

  // Plan 35: `?crim=<property id>` opens the CRIM sheet for that property.
  let crim: CrimSheetData | null = null;
  const crimProperty = searchParams.crim ? all.find((p) => p.id === searchParams.crim) : undefined;
  if (crimProperty) {
    const [{ data: account }, { data: bills }, { data: rates }] = await Promise.all([
      supabase.from("property_crim").select("*").eq("property_id", crimProperty.id).maybeSingle(),
      supabase.from("crim_bills").select("*").eq("property_id", crimProperty.id).order("due_date", { ascending: false }),
      supabase.from("crim_tax_rates").select("municipality, fiscal_year, inmueble_rate"),
    ]);
    crim = {
      property: { id: crimProperty.id, name: crimProperty.name, city: crimProperty.city ?? null },
      account: (account as PropertyCrim | null) ?? null,
      bills: (bills ?? []) as CrimBill[],
      rates: rates ?? [],
      today: todayPR(),
    };
  }

  const rows: PropertyRow[] = all.map((p) => ({
    ...p,
    activeLeases: leasesByProperty[p.id] ?? 0,
    ytdExpenses: expenseByProperty[p.id] ?? 0,
    annualIncome: incomeByProperty[p.id] ?? 0,
  }));

  return (
    <PropertiesView
      rows={rows}
      initialQuery={searchParams.q}
      openNew={searchParams.new === "1"}
      openImport={searchParams.import === "1"}
      crim={crim}
    />
  );
}
