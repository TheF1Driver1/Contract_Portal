// Reads a Twilio webhook (form-encoded POST) and checks X-Twilio-Signature.
import { verifyTwilioSignature } from "@/lib/messaging/signatures";

export async function readTwilioWebhook(req: Request): Promise<{ ok: boolean; params: Record<string, string> }> {
  const form = new URLSearchParams(await req.text());
  const params: Record<string, string> = {};
  for (const [k, v] of form) params[k] = v;
  // Twilio signs the public URL it called; behind a proxy req.url may differ.
  const url = new URL(req.url);
  const urls = [req.url];
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (base) urls.push(`${base}${url.pathname}${url.search}`);
  const ok = verifyTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    signature: req.headers.get("x-twilio-signature"),
    urls,
    params,
  });
  return { ok, params };
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** TwiML reply: an optional message back to the sender. */
export function twiml(message?: string): Response {
  const body = message ? `<Message>${xmlEscape(message)}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}
