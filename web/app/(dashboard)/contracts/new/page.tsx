import { createClient } from "@/lib/supabase-server";
import ContractBuilder from "@/components/ContractBuilder";
import { redirect } from "next/navigation";
import type { Property, Tenant } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export default async function NewContractPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: properties }, { data: tenants }, { data: profile }] = await Promise.all([
    supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    supabase.from("tenants").select("*").eq("owner_id", user.id).order("full_name"),
    supabase.from("profiles").select("email").eq("id", user.id).single(),
  ]);

  const landlordEmail = (profile as { email?: string } | null)?.email ?? user.email ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Contracts
        </p>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          New Contract
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Fill out the form to generate a rental contract
        </p>
      </div>

      {/* Pre-flight warnings */}
      {(!properties?.length || !tenants?.length) && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 text-sm"
          style={{ background: "rgba(255,149,0,0.1)", color: "var(--text-primary)" }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#ff9500" }} />
          <div className="space-y-1">
            {!properties?.length && (
              <p>Add at least one <strong>property</strong> before creating a contract.</p>
            )}
            {!tenants?.length && (
              <p>Add at least one <strong>tenant</strong> before creating a contract.</p>
            )}
          </div>
        </div>
      )}

      <ContractBuilder
        properties={(properties ?? []) as Property[]}
        tenants={(tenants ?? []) as Tenant[]}
        userId={user.id}
        landlordEmail={landlordEmail}
      />
    </div>
  );
}
