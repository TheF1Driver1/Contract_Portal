import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id, tenant_email, tenant_name, used, expires_at, contract_id, contract:contracts(property:properties(name))")
    .eq("token", params.token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.used || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired or already been used" }, { status: 410 });
  }

  const property = (invite.contract as { property: { name: string } | null } | null)?.property;
  const propertyName = property?.name ?? "your property";

  return NextResponse.json({
    tenantEmail: invite.tenant_email,
    tenantName: invite.tenant_name,
    contractId: invite.contract_id,
    propertyName,
    expiresAt: invite.expires_at,
  });
}
