import { createAdminClient } from "@/lib/supabase-server";
import InviteSignupClient from "./InviteSignupClient";

interface InviteData {
  tenantEmail: string;
  tenantName: string;
  contractId: string;
  propertyName: string;
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("tenant_invites")
    .select("tenant_email, tenant_name, used, expires_at, contract_id, contract:contracts(property:properties(name))")
    .eq("token", params.token)
    .single();

  const expired = !invite || invite.used || new Date(invite.expires_at) < new Date();

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Link Expired</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This invite link has expired or has already been used. Please contact your landlord for a new link.
          </p>
          <a
            href="/"
            className="mt-6 inline-block text-sm text-neutral-500 hover:text-white transition-colors"
          >
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  const property = (invite.contract as { property: { name: string } | null } | null)?.property;

  const data: InviteData = {
    tenantEmail: invite.tenant_email,
    tenantName: invite.tenant_name,
    contractId: invite.contract_id,
    propertyName: property?.name ?? "your property",
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <InviteSignupClient {...data} token={params.token} />
    </div>
  );
}
