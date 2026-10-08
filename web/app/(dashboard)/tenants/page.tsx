import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Tenant } from "@/lib/types";
import { TenantsView } from "@/components/tenants/TenantsView";

export default async function TenantsPage(props: {
  searchParams: Promise<{ q?: string; new?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .eq("owner_id", user.id)
    .order("full_name");

  return (
    <TenantsView
      tenants={(tenants ?? []) as Tenant[]}
      initialQuery={searchParams.q}
      openNew={searchParams.new === "1"}
    />
  );
}
