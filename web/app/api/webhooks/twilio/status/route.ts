import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { readTwilioWebhook } from "@/lib/messaging/twilio-request";
import { fromTwilioStatus } from "@/lib/messaging/inbound";
import { applyStatus } from "@/lib/messaging/webhooks";

export const dynamic = "force-dynamic";

/** Twilio StatusCallback for SMS and WhatsApp sends (queued → sent → delivered → read, or failed). */
export async function POST(req: Request) {
  const { ok, params } = await readTwilioWebhook(req);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  const sid = params.MessageSid || params.SmsSid;
  const status = fromTwilioStatus(params.MessageStatus || params.SmsStatus);
  if (sid && status) {
    const error = params.ErrorCode ? `Twilio ${params.ErrorCode}${params.ErrorMessage ? `: ${params.ErrorMessage}` : ""}` : null;
    await applyStatus(createAdminClient(), sid, status, error).catch((e) =>
      console.error(JSON.stringify({ level: "error", msg: "twilio status update failed", err: String(e) }))
    );
  }
  return new NextResponse(null, { status: 204 });
}
