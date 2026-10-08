import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getPlan, hasFeature } from "@/lib/entitlements";
import { getTaxResidency, loadAnnualPackage, viewFor } from "@/lib/tax/load";
import type { TaxView } from "@/lib/tax/annual";
import { AnnualPackageView } from "@/components/tax/AnnualPackageView";

export const dynamic = "force-dynamic";

export default async function AnnualPackagePage(props: { searchParams: Promise<{ year?: string; property?: string; view?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = years.includes(requested) ? requested : currentYear;

  const [{ data: properties }, residency, plan] = await Promise.all([
    supabase.from("properties").select("id, name").eq("owner_id", user.id).order("name"),
    getTaxResidency(supabase, user.id),
    getPlan(supabase, user.id),
  ]);
  const propertyId = (properties ?? []).some((p) => p.id === searchParams.property) ? searchParams.property! : null;
  const view: TaxView = searchParams.view === "schedule_e" || searchParams.view === "anejo_n" ? searchParams.view : viewFor(residency);

  const pkg = await loadAnnualPackage(supabase, user.id, year, propertyId);

  return (
    <AnnualPackageView
      pkg={pkg}
      properties={properties ?? []}
      years={years}
      propertyId={propertyId}
      view={view}
      residency={residency}
      canExport={hasFeature(plan, "expense_export")}
    />
  );
}
