import { createClient } from "@/lib/supabase-server";
import ContractBuilder from "@/components/ContractBuilder";
import { redirect } from "next/navigation";
import type { Property, Tenant } from "@/lib/types";

export default async function NewContractPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("owner_id", user.id)
      .order("name"),
    supabase
      .from("tenants")
      .select("*")
      .eq("owner_id", user.id)
      .order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Contract</h1>
        <p className="text-sm text-muted-foreground">
          Fill out the form to generate a rental contract
        </p>
      </div>

      {(!properties?.length || !tenants?.length) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {!properties?.length && (
            <p>Add at least one property before creating a contract.</p>
          )}
          {!tenants?.length && (
            <p>Add at least one tenant before creating a contract.</p>
          )}
        </div>
      )}

      <ContractBuilder
        properties={(properties ?? []) as Property[]}
        tenants={(tenants ?? []) as Tenant[]}
        userId={user.id}
      />
    </div>
  );
}
