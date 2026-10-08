export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { loadInspection } from "@/lib/inspections/load";
import { InspectionEditor } from "@/components/inspections/InspectionEditor";

export default async function InspectionPage(props: { params: Promise<{ id: string; inspectionId: string }> }) {
  const { id, inspectionId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(inspectionId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS confirms the landlord owns it before the service role signs photo URLs.
  const { data: own } = await supabase.from("inspections").select("id").eq("id", inspectionId).eq("contract_id", id).eq("owner_id", user.id).maybeSingle();
  if (!own) notFound();
  const [loaded, { data: contract }] = await Promise.all([
    loadInspection(createAdminClient(), inspectionId),
    supabase.from("contracts").select("id, unit_number, property:properties(name), tenant:tenants(full_name)").eq("id", id).maybeSingle(),
  ]);
  if (!loaded) notFound();
  const property = contract?.property as { name?: string } | null;
  const tenant = contract?.tenant as { full_name?: string } | null;

  return (
    <InspectionEditor
      inspection={loaded.inspection}
      items={loaded.items}
      subtitle={[tenant?.full_name, property?.name, contract?.unit_number].filter(Boolean).join(" · ")}
    />
  );
}
