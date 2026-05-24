import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { PropertyManagerInviteSchema } from "@/lib/schemas";
import { canInviteManager, getMaxManagers } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// GET /api/managers — list all manager invites for the owner
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("property_managers")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/managers — send a manager invite
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = PropertyManagerInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { manager_email, property_ids, permissions } = parsed.data;

  // Check plan limit
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const plan = (profile?.plan ?? "free") as SubscriptionPlan;

  const { data: existing } = await supabase
    .from("property_managers")
    .select("id")
    .eq("owner_id", user.id)
    .in("status", ["pending", "accepted"]);

  const currentCount = existing?.length ?? 0;
  if (!canInviteManager(plan, currentCount)) {
    const max = getMaxManagers(plan);
    return NextResponse.json(
      { error: `Your plan allows up to ${max} property manager${max === 1 ? "" : "s"}. Upgrade to add more.` },
      { status: 403 }
    );
  }

  // Prevent duplicate pending invites to the same email
  const { data: dupe } = await supabase
    .from("property_managers")
    .select("id")
    .eq("owner_id", user.id)
    .eq("manager_email", manager_email.toLowerCase())
    .in("status", ["pending", "accepted"])
    .single();

  if (dupe) {
    return NextResponse.json(
      { error: "An active invite already exists for this email." },
      { status: 409 }
    );
  }

  const invite_token = randomBytes(32).toString("hex");

  const { data: record, error: insertErr } = await supabase
    .from("property_managers")
    .insert({
      owner_id: user.id,
      manager_email: manager_email.toLowerCase(),
      property_ids,
      permissions: permissions ?? { view: true, create_contracts: true, sign_contracts: false },
      status: "pending",
      invite_token,
    })
    .select()
    .single();

  if (insertErr || !record) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  // Send invite email
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const inviteUrl = `${appUrl}/invite/manager/${invite_token}`;

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const ownerName = ownerProfile?.full_name || ownerProfile?.email || "A landlord";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

    await resend.emails.send({
      from,
      to: manager_email,
      subject: `${ownerName} invited you to manage properties on ContractOS`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0f1c;color:#e0e8f0;border-radius:12px">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Property Manager Invitation</h2>
          <p style="color:#8a9ab8;font-size:14px;margin-bottom:24px">
            <strong style="color:#e0e8f0">${ownerName}</strong> has invited you to manage
            ${property_ids.length} propert${property_ids.length === 1 ? "y" : "ies"} on ContractOS.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
            Accept Invitation
          </a>
          <p style="color:#4a5a78;font-size:12px;margin-top:24px">
            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error("[managers POST] email error:", e);
    // Don't fail the request — invite record exists, email is best-effort
  }

  return NextResponse.json(record, { status: 201 });
}
