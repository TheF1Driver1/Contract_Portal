import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { CrimBill, PropertyCrim } from "@/lib/db";
import { todayPR } from "@/lib/rent/service";
import { billStatus, estimateCrim, findRate, fiscalYearOf } from "@/lib/tax/crim";
import { CrimOverview, type CrimRow } from "@/components/tax/CrimOverview";

export const dynamic = "force-dynamic";

export default async function CrimReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayPR();
  const fy = fiscalYearOf(today);
  const [{ data: properties }, { data: accounts }, { data: bills }, { data: rates }] = await Promise.all([
    supabase.from("properties").select("id, name, city").eq("owner_id", user.id).order("name"),
    supabase.from("property_crim").select("*").eq("owner_id", user.id),
    supabase.from("crim_bills").select("*").eq("owner_id", user.id).is("voided_at", null),
    supabase.from("crim_tax_rates").select("municipality, fiscal_year, inmueble_rate"),
  ]);

  const allBills = (bills ?? []) as CrimBill[];
  const rows: CrimRow[] = (properties ?? []).map((p) => {
    const a = ((accounts ?? []) as PropertyCrim[]).find((x) => x.property_id === p.id) ?? null;
    const municipality = a?.municipality || p.city || null;
    const rate = findRate(rates ?? [], municipality, fy);
    const est = estimateCrim({ assessedValue: a?.assessed_value, exoneration: a?.exoneration_amount, ratePct: rate?.ratePct });
    const mine = allBills.filter((b) => b.property_id === p.id);
    const thisFy = mine.filter((b) => b.fiscal_year === fy);
    const unpaid = mine.filter((b) => !b.paid_on).sort((x, y) => x.due_date.localeCompare(y.due_date));
    return {
      id: p.id,
      name: p.name,
      municipality,
      assessed: a?.assessed_value != null ? Number(a.assessed_value) : null,
      estimate: est?.annual ?? null,
      billed: thisFy.reduce((s, b) => s + Number(b.amount), 0),
      paid: thisFy.filter((b) => b.paid_on).reduce((s, b) => s + Number(b.amount), 0),
      nextDue: unpaid[0]?.due_date ?? null,
      overdue: unpaid.some((b) => billStatus(b, today) === "overdue"),
    };
  });

  return <CrimOverview rows={rows} fiscalYear={fy} />;
}
