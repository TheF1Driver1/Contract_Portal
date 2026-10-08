export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import type { MaintenancePhoto, MaintenanceRequest, MaintenanceUpdate } from "@/lib/db";
import { isRenderable } from "@/lib/maintenance/logic";
import { signedPhotoUrls } from "@/lib/maintenance/service";
import { todayPR } from "@/lib/rent/service";
import { RequestDetail } from "@/components/maintenance/RequestDetail";

export default async function MaintenanceDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase.from("maintenance_requests").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!request) notFound();
  const r = request as MaintenanceRequest;

  const [{ data: updates }, { data: photos }, { data: contract }, { data: property }, { data: expense }] = await Promise.all([
    supabase.from("maintenance_updates").select("*").eq("request_id", id).order("created_at"),
    supabase.from("maintenance_photos").select("*").eq("request_id", id).order("created_at"),
    r.contract_id
      ? supabase.from("contracts").select("id, unit_number, tenant:tenants(full_name, phone, email)").eq("id", r.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("properties").select("name, address, city").eq("id", r.property_id).maybeSingle(),
    r.expense_id ? supabase.from("property_expenses").select("id, amount, expense_date").eq("id", r.expense_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Ownership was verified through RLS above; the service role signs the photo URLs.
  const ph = (photos ?? []) as MaintenancePhoto[];
  const urls = await signedPhotoUrls(createAdminClient(), ph.map((p) => p.path));
  const tenant = (contract?.tenant ?? null) as { full_name?: string; phone?: string | null; email?: string | null } | null;

  return (
    <RequestDetail
      request={{ ...r, cost: r.cost != null ? Number(r.cost) : null }}
      updates={(updates ?? []) as MaintenanceUpdate[]}
      photos={ph.map((p) => ({ id: p.id, url: urls.get(p.path) ?? null, renderable: isRenderable(p.path) }))}
      property={[property?.name, contract?.unit_number].filter(Boolean).join(" · ") || property?.address || "—"}
      address={[property?.address, property?.city].filter(Boolean).join(", ")}
      tenant={tenant ? { name: tenant.full_name ?? "", phone: tenant.phone ?? null, email: tenant.email ?? null } : null}
      expense={expense ? { amount: Number(expense.amount), date: expense.expense_date } : null}
      today={todayPR()}
    />
  );
}
