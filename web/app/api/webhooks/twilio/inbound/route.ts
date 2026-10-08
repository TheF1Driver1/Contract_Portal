import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { readTwilioWebhook, twiml } from "@/lib/messaging/twilio-request";
import { handleInbound } from "@/lib/messaging/webhooks";

export const dynamic = "force-dynamic";

/** Inbound SMS / WhatsApp (Twilio messaging webhook): opt-out keywords, HELP, and replies from tenants. */
export async function POST(req: Request) {
  const { ok, params } = await readTwilioWebhook(req);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  try {
    return twiml(await handleInbound(createAdminClient(), params));
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "twilio inbound failed", err: String(e) }));
    return twiml();
  }
}
