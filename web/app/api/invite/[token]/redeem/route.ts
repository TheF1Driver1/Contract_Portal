import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id, tenant_email, contract_id, used, expires_at")
    .eq("token", params.token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.used || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired or already been used" }, { status: 410 });
  }

  if (user.email?.toLowerCase() !== invite.tenant_email.toLowerCase()) {
    return NextResponse.json({ error: "Email does not match this invite" }, { status: 403 });
  }

  await admin
    .from("tenant_invites")
    .update({ used: true, used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", invite.id);

  await admin
    .from("profiles")
    .update({ role: "tenant" })
    .eq("id", user.id);

  return NextResponse.json({ contractId: invite.contract_id });
}
