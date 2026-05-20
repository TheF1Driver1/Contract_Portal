import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { sendTenantInviteEmail } from "@/lib/notify";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const admin = createAdminClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, status, tenant_id, owner_id, tenant:tenants(full_name, email), property:properties(name)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status === "signed") {
    return NextResponse.json({ error: "Contract is already signed" }, { status: 409 });
  }

  const tenant = contract.tenant as { full_name: string; email: string | null } | null;
  const tenantEmail = tenant?.email;
  const tenantName = tenant?.full_name ?? "";

  if (!tenantEmail) {
    return NextResponse.json({ error: "Tenant has no email address" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const property = contract.property as { name: string } | null;
  const propertyName = property?.name ?? "your property";

  const { data: landlordProfile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", user.id)
    .single();
  const landlordName = landlordProfile?.full_name ?? landlordProfile?.company_name ?? "";

  // Remove any existing unused invite for this contract
  await admin
    .from("tenant_invites")
    .delete()
    .eq("contract_id", params.id)
    .eq("used", false);

  const token = crypto.randomUUID();

  const { error: insertError } = await admin.from("tenant_invites").insert({
    token,
    contract_id: params.id,
    owner_id: user.id,
    tenant_email: tenantEmail,
    tenant_name: tenantName,
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  // Update contract status to 'sent' if still draft
  if (contract.status === "draft") {
    await supabase
      .from("contracts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("owner_id", user.id);
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const inviteUrl = `${appUrl}/invite/${token}`;

  try {
    await sendTenantInviteEmail(tenantEmail, tenantName, propertyName, inviteUrl, landlordName);
  } catch (emailErr) {
    return NextResponse.json(
      { error: "Invite created but email failed: " + (emailErr as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, inviteUrl });
}
