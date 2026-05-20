import { redirect, notFound } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import TenantSigningClient from "./TenantSigningClient";
import type { Contract } from "@/lib/types";

export default async function TenantSignPage({ params }: { params: { contractId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Verify the tenant has a redeemed invite for this contract
  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id")
    .eq("contract_id", params.contractId)
    .eq("used_by", user.id)
    .eq("used", true)
    .single();

  if (!invite) notFound();

  const { data: contract } = await admin
    .from("contracts")
    .select("*, property:properties(name, address, city, state), tenant:tenants(full_name)")
    .eq("id", params.contractId)
    .single();

  if (!contract) notFound();

  if (contract.status === "signed") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Contract Signed</h1>
          <p className="mt-2 text-sm text-neutral-400">
            You have already signed this lease agreement. Your landlord has been notified.
          </p>
          {contract.tenant_signature && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">Your Signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contract.tenant_signature}
                alt="Your signature"
                className="mx-auto max-h-24 rounded-lg border border-white/10 bg-white p-2"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <TenantSigningClient contract={contract as Contract} />
    </div>
  );
}
