export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileDown } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { loadInspection } from "@/lib/inspections/load";
import { tenantHasLease } from "@/lib/maintenance/service";
import { InspectionReadOnly } from "@/components/inspections/InspectionEditor";
import { InspectionAck } from "@/components/inspections/InspectionAck";

export default async function PortalInspectionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Tenants read through the service role, only for leases they redeemed an invite for.
  const admin = createAdminClient();
  const { data: insp } = await admin.from("inspections").select("id, contract_id, status").eq("id", id).maybeSingle();
  if (!insp || insp.status !== "completed" || !(await tenantHasLease(admin, user.id, insp.contract_id))) notFound();
  const loaded = await loadInspection(admin, id);
  if (!loaded) notFound();
  const t = await getTranslations("inspections");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:py-10">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portal">
            <ArrowLeft aria-hidden />
            {t("portal.back")}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-semibold text-foreground">{t(`kind.${loaded.inspection.kind}`)}</h1>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/inspections/${id}/pdf`} target="_blank" rel="noopener">
              <FileDown aria-hidden />
              {t("downloadPdf")}
            </a>
          </Button>
        </div>
      </div>
      {!loaded.inspection.tenant_acknowledged_at && <InspectionAck inspectionId={id} />}
      <InspectionReadOnly inspection={loaded.inspection} items={loaded.items} />
    </main>
  );
}
