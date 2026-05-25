export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase-server";
import ManagerInviteClient from "./ManagerInviteClient";

export default async function ManagerInvitePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("property_managers")
    .select("id, manager_email, status, owner_id, property_ids, invited_at")
    .eq("invite_token", params.token)
    .single();

  if (!invite || invite.status !== "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Invite Unavailable</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This invitation link has already been used, declined, or revoked. Contact the property owner for a new invite.
          </p>
          <a href="/" className="mt-6 inline-block text-sm text-neutral-500 hover:text-white transition-colors">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  // Fetch owner profile for display
  const { data: owner } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", invite.owner_id)
    .single();

  // Fetch property names
  const { data: properties } = await admin
    .from("properties")
    .select("id, name, address")
    .in("id", invite.property_ids as string[]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <ManagerInviteClient
        token={params.token}
        managerEmail={invite.manager_email}
        ownerName={owner?.full_name || owner?.email || "A landlord"}
        properties={properties ?? []}
      />
    </div>
  );
}
