import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { verifySvixSignature } from "@/lib/messaging/signatures";
import { fromResendEvent } from "@/lib/messaging/inbound";
import { applyStatus } from "@/lib/messaging/webhooks";

export const dynamic = "force-dynamic";

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } };
};

/** Resend delivery events (Svix-signed): sent, delivered, opened, bounced, complained. */
export async function POST(req: Request) {
  const body = await req.text();
  const ok = verifySvixSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body,
  });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const status = fromResendEvent(event.type);
  const emailId = event.data?.email_id;
  if (status && emailId) {
    const error =
      event.type === "email.complained"
        ? "complained (marked as spam)"
        : event.data?.bounce?.message ?? event.data?.failed?.reason ?? event.type ?? null;
    try {
      await applyStatus(createAdminClient(), emailId, status, error);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "resend webhook update failed", err: String(e) }));
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
