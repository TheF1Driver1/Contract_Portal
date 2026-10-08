import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { MaintenanceRequest } from "@/lib/db";
import { compareRequests, isOpen, needsAttention } from "@/lib/maintenance/logic";
import { todayPR } from "@/lib/rent/service";
import { MaintenanceList, type MaintenanceRow } from "@/components/maintenance/MaintenanceList";

type LeaseRow = { id: string; status: string; unit_number: string | null; property: { name: string | null } | null; tenant: { full_name: string | null } | null };

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: requests }, { data: contracts }, { data: properties }] = await Promise.all([
    supabase.from("maintenance_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, status, unit_number, property:properties(name), tenant:tenants(full_name)").eq("owner_id", user.id),
    supabase.from("properties").select("id, name").eq("owner_id", user.id),
  ]);

  const leases = (contracts ?? []) as unknown as LeaseRow[];
  const leaseById = new Map(leases.map((c) => [c.id, c]));
  const propertyName = new Map((properties ?? []).map((p) => [p.id, p.name as string]));
  const reqs = ((requests ?? []) as MaintenanceRequest[]).sort(compareRequests);

  const rows: MaintenanceRow[] = reqs.map((r) => {
    const lease = r.contract_id ? leaseById.get(r.contract_id) : undefined;
    return {
      id: r.id,
      title: r.title,
      property: [lease?.property?.name ?? propertyName.get(r.property_id), lease?.unit_number].filter(Boolean).join(" · ") || "—",
      tenant: lease?.tenant?.full_name ?? "",
      category: r.category,
      urgency: r.urgency,
      status: r.status,
      createdAt: r.created_at,
      scheduledFor: r.scheduled_for,
      cost: r.cost != null ? Number(r.cost) : null,
      fromTenant: r.submitted_by_kind === "tenant",
    };
  });

  const year = todayPR().slice(0, 4);
  const kpis = {
    open: reqs.filter((r) => isOpen(r.status)).length,
    urgent: reqs.filter(needsAttention).length,
    scheduled: reqs.filter((r) => r.status === "scheduled").length,
    costYear: reqs.filter((r) => r.cost != null && (r.resolved_at ?? r.created_at).startsWith(year)).reduce((s, r) => s + Number(r.cost), 0),
  };

  const signed = leases
    .filter((c) => c.status === "signed")
    .map((c) => ({ id: c.id, label: [c.tenant?.full_name, c.property?.name, c.unit_number].filter(Boolean).join(" · ") || c.id.slice(0, 8) }));

  return <MaintenanceList rows={rows} leases={signed} kpis={kpis} />;
}
