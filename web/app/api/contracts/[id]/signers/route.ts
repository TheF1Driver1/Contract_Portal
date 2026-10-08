import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";
import { requestMeta, requestSignatures, revokeRequests } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";
import { trackEvent } from "@/lib/analytics";

type Ctx = { params: Promise<{ id: string }> };

/** Signers and evidence for the landlord's contract page. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [signers, events] = await Promise.all([
    supabase
      .from("contract_signers")
      .select("id, role, name, email, phone, locale, sign_order, status, token_expires_at, otp_channel, verified_at, consented_at, signed_at, declined_reason, in_person, created_at")
      .eq("contract_id", id)
      .neq("status", "revoked")
      .order("sign_order"),
    supabase
      .from("signature_events")
      .select("id, event, actor, ip, created_at, signer_id, detail")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return NextResponse.json({ signers: signers.data ?? [], events: events.data ?? [] });
}

/** Sends the lease for signature to the tenant and co-tenants (in order). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;
  try {
    const signers = await requestSignatures(createAdminClient(), { contractId: id, ownerId: user.id, appUrl: appUrl(req), meta: requestMeta(req) });
    await trackEvent("contract_sent", { channel: "esign" });
    return NextResponse.json({ signers: signers.map(({ token_hash: _t, otp_hash: _o, ...s }) => s) });
  } catch (e) {
    return signErrorResponse(e);
  }
}

/** Cancels an open signature request so the draft can be edited. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await revokeRequests(createAdminClient(), { contractId: id, ownerId: user.id, meta: requestMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return signErrorResponse(e);
  }
}
