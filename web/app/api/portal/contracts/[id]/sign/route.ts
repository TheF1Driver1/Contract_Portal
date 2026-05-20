import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { TenantSignatureSchema } from "@/lib/schemas";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify a redeemed invite exists for this tenant and contract
  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id")
    .eq("contract_id", params.id)
    .eq("used_by", user.id)
    .eq("used", true)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = TenantSignatureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await admin
    .from("contracts")
    .update({
      tenant_signature: parsed.data.tenant_signature,
      signed_at: new Date().toISOString(),
      status: "signed",
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
