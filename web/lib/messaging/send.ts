// sendMessage: the one way ContractOS sends a notice by email, SMS or
// WhatsApp. It checks consent, logs the send before it happens (a unique
// idempotency key makes repeats a no-op), sends through the provider and
// records the provider id and status for the delivery webhooks.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageChannel, MessageStatus } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase-server";
import { sendResendEmail, sendTwilioSms, sendTwilioWhatsApp, twilioStatusCallback } from "@/lib/notify";
import { normalizePhone } from "@/lib/messaging/inbound";
import { renderMessage, whatsappTemplate, type TemplateName, type TemplateVars } from "@/lib/messaging/templates";

type Client = SupabaseClient<Database>;

export type SendMessageInput = {
  channel: MessageChannel;
  to: string;
  template: TemplateName;
  locale?: string | null;
  vars: TemplateVars;
  contractId?: string | null;
  ownerId: string;
  recipient: { kind: "tenant" | "landlord" | "signer"; id?: string | null };
  /** Same key → sent at most once (a failed send may be retried with it). */
  idempotencyKey: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Defaults to the service-role client. */
  db?: Client;
};

export type SkipReason =
  | "duplicate"
  | "no_consent"
  | "invalid_address"
  | "whatsapp_not_configured"
  | "sms_not_configured";

export type SendMessageResult = {
  id: string | null;
  status: MessageStatus;
  providerId?: string | null;
  skipped?: SkipReason;
  error?: string;
};

const clip = (s: string, n = 500) => (s.length > n ? s.slice(0, n) : s);

/** True when the recipient opted in to this channel and has not texted STOP from this number. */
async function hasConsent(db: Client, input: SendMessageInput, phone: string): Promise<boolean> {
  const { data, error } = await db
    .from("messaging_consents")
    .select("subject_id, address, status")
    .eq("owner_id", input.ownerId)
    .eq("channel", input.channel);
  if (error || !data) return false;
  const rows = data.filter((r) => r.address === phone || (!!input.recipient.id && r.subject_id === input.recipient.id));
  if (rows.some((r) => r.address === phone && r.status === "opted_out")) return false;
  return rows.some((r) => r.status === "opted_in");
}

function configured(channel: MessageChannel): SkipReason | null {
  // Email is the default channel; a missing key fails loudly like before.
  if (channel === "email") return null;
  if (channel === "sms")
    return process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER ? null : "sms_not_configured";
  return process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? null : "whatsapp_not_configured";
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const db = input.db ?? createAdminClient();
  const locale = input.locale === "en" ? "en" : "es";
  const isPhone = input.channel !== "email";
  const to = isPhone ? normalizePhone(input.to) : input.to.trim().toLowerCase();
  const base = {
    owner_id: input.ownerId,
    contract_id: input.contractId ?? null,
    direction: "outbound" as const,
    recipient_kind: input.recipient.kind,
    recipient_id: input.recipient.id ?? null,
    channel: input.channel,
    template: input.template,
    locale: locale as "es" | "en",
    to_address: clip(to ?? input.to, 320),
  };

  // ── Checks that skip without consuming the idempotency key ──────────────
  let skip: SkipReason | null = null;
  if (!to || (!isPhone && !to.includes("@"))) skip = "invalid_address";
  else if (isPhone && !(await hasConsent(db, input, to))) skip = "no_consent";
  else skip = configured(input.channel);
  const wa = input.channel === "whatsapp" ? whatsappTemplate(input.template, locale, input.vars) : null;
  if (!skip && input.channel === "whatsapp" && !wa) skip = "whatsapp_not_configured";
  if (skip) {
    const { data } = await db.from("message_log").insert({ ...base, status: "skipped", error: skip }).select("id").maybeSingle();
    return { id: data?.id ?? null, status: "skipped", skipped: skip };
  }

  // ── Log first: the unique key stops a second send ───────────────────────
  let id: string | null = null;
  const ins = await db
    .from("message_log")
    .insert({ ...base, idempotency_key: input.idempotencyKey, status: "queued" })
    .select("id")
    .maybeSingle();
  if (ins.error?.code === "23505") {
    const { data: prev } = await db
      .from("message_log")
      .select("id, status, provider_id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (!prev) return { id: null, status: "skipped", skipped: "duplicate" };
    if (prev.status !== "failed") return { id: prev.id, status: prev.status, providerId: prev.provider_id, skipped: "duplicate" };
    // A failed attempt may be retried once someone (or the next run) asks again.
    const { data: retry } = await db
      .from("message_log")
      .update({ status: "queued", error: null })
      .eq("id", prev.id)
      .eq("status", "failed")
      .select("id");
    if (!retry?.length) return { id: prev.id, status: prev.status, skipped: "duplicate" };
    id = prev.id;
  } else if (ins.error) {
    // Logging must not block a notice (e.g. migration not applied yet).
    console.error(JSON.stringify({ level: "error", msg: "message_log insert failed", err: ins.error.message, template: input.template }));
  } else {
    id = ins.data?.id ?? null;
  }

  // ── Send ────────────────────────────────────────────────────────────────
  const dest = to!; // checked above
  try {
    const msg = renderMessage(input.template, locale, input.vars);
    let providerId: string | null;
    if (input.channel === "email") {
      providerId = await sendResendEmail(dest, msg.subject, msg.html, input.attachments);
    } else if (input.channel === "sms") {
      providerId = await sendTwilioSms(dest, msg.text, { statusCallback: twilioStatusCallback() });
    } else {
      providerId = (await sendTwilioWhatsApp(dest, wa!, { statusCallback: twilioStatusCallback() })).sid;
    }
    if (id) {
      await db
        .from("message_log")
        .update({ provider: input.channel === "email" ? "resend" : "twilio", provider_id: providerId, status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
    }
    return { id, status: "sent", providerId };
  } catch (e) {
    const error = clip((e as Error).message || String(e));
    if (id) await db.from("message_log").update({ status: "failed", error }).eq("id", id);
    console.error(JSON.stringify({ level: "error", msg: "message send failed", template: input.template, channel: input.channel, err: error }));
    return { id, status: "failed", error };
  }
}
