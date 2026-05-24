import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// POST /api/managers/invite/[token] — accept or decline a manager invite
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action: "accept" | "decline" = body.action === "decline" ? "decline" : "accept";

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("property_managers")
    .select("id, manager_email, status, owner_id")
    .eq("invite_token", params.token)
    .single();

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 });
  }

  if (user.email?.toLowerCase() !== invite.manager_email.toLowerCase()) {
    return NextResponse.json({ error: "Email does not match this invite." }, { status: 403 });
  }

  const update =
    action === "accept"
      ? { status: "accepted", manager_user_id: user.id, accepted_at: new Date().toISOString() }
      : { status: "declined" };

  const { error } = await admin
    .from("property_managers")
    .update(update)
    .eq("id", invite.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action });
}
