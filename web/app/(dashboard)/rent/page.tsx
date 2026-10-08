import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Payment, RentCharge } from "@/lib/db";
import { summarize } from "@/lib/rent/schedule";
import { todayPR } from "@/lib/rent/service";
import { RentOverview, type RentRow } from "@/components/rent/RentOverview";
import { AthMovilCard, type AthStatus } from "@/components/rent/AthMovilCard";

export default async function RentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayPR();
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: ledgers } = await supabase.from("rent_ledgers").select("contract_id").eq("owner_id", user.id);
  const ids = (ledgers ?? []).map((l) => l.contract_id);

  // Safe status only (security definer RPC); tokens never reach the page.
  const { data: athRows } = await supabase.rpc("ath_movil_status");
  const athRow = Array.isArray(athRows) ? athRows[0] : null;
  const ath: AthStatus = { connected: !!athRow?.connected, businessName: athRow?.business_name ?? null, connectedAt: athRow?.connected_at ?? null };

  const [{ data: contracts }, { data: charges }, { data: payments }] = ids.length
    ? await Promise.all([
        supabase.from("contracts").select("id, rent_amount, status, tenant:tenants(full_name), property:properties(name)").in("id", ids),
        supabase.from("rent_charges").select("*").in("contract_id", ids),
        supabase.from("payments").select("*").in("contract_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const allCharges = (charges ?? []) as RentCharge[];
  const allPayments = (payments ?? []) as Payment[];
  const rows: RentRow[] = (contracts ?? []).map((c) => {
    const s = summarize(
      allCharges.filter((x) => x.contract_id === c.id).map((x) => ({ kind: x.kind, period: x.period, due_date: x.due_date, amount: Number(x.amount), voided: !!x.voided_at })),
      allPayments.filter((p) => p.contract_id === c.id).map((p) => ({ amount: Number(p.amount), received_on: p.received_on, voided: !!p.voided_at })),
      today
    );
    return {
      id: c.id,
      tenant: (c.tenant as { full_name?: string } | null)?.full_name ?? "—",
      property: (c.property as { name?: string } | null)?.name ?? "—",
      rent: Number(c.rent_amount) || 0,
      balance: s.balance,
      overdue: s.overdue,
      nextDue: s.nextDue?.date ?? null,
      status: c.status,
    };
  });

  const inMonth = (d: string) => d >= monthStart && d <= `${today.slice(0, 7)}-31`;
  const kpis = {
    expected: allCharges.filter((c) => !c.voided_at && inMonth(c.due_date)).reduce((s, c) => s + Number(c.amount), 0),
    collected: allPayments.filter((p) => !p.voided_at && inMonth(p.received_on)).reduce((s, p) => s + Number(p.amount), 0),
    overdue: rows.reduce((s, r) => s + r.overdue, 0),
    leases: rows.length,
  };

  return (
    <>
      <RentOverview rows={rows} kpis={kpis} />
      <AthMovilCard status={ath} />
    </>
  );
}
