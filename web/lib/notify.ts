import { emailLayout } from "@/lib/emails/layout";
import { emailT } from "@/lib/emails/translator";
// Carriers (A2P 10DLC) require brand identification and opt-out instructions.
const SMS_FOOTER = "ContractOS. Responde STOP para cancelar / Reply STOP to opt out.";

export function withSmsFooter(body: string): string {
  return /\bSTOP\b/.test(body) ? body : `${body}\n\n${SMS_FOOTER}`;
}

/** Twilio delivery-status callback, when the app has a public URL. */
export function twilioStatusCallback(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base && /^https:\/\//.test(base) ? `${base.replace(/\/$/, "")}/api/webhooks/twilio/status` : undefined;
}

async function twilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio env vars not configured");
  const twilio = (await import("twilio")).default;
  return twilio(sid, token);
}

/** Sends an SMS (with the opt-out footer). Returns the Twilio message SID. */
export async function sendTwilioSms(to: string, body: string, opts?: { statusCallback?: string }): Promise<string> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("Twilio env vars not configured");
  const client = await twilioClient();
  const msg = await client.messages.create({ body: withSmsFooter(body), from, to, statusCallback: opts?.statusCallback });
  return msg.sid;
}

/**
 * Sends an approved WhatsApp template (Twilio Content API). Free-form text is
 * only allowed inside a 24-hour customer-service window, so outbound notices
 * always use a template. Returns the SID and Twilio's initial status.
 */
export async function sendTwilioWhatsApp(
  to: string,
  template: { contentSid: string; variables: Record<string, string> },
  opts?: { statusCallback?: string }
): Promise<{ sid: string; status: string }> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("TWILIO_WHATSAPP_FROM not configured");
  const client = await twilioClient();
  const wa = (n: string) => (n.startsWith("whatsapp:") ? n : `whatsapp:${n}`);
  const msg = await client.messages.create({
    from: wa(from),
    to: wa(to),
    contentSid: template.contentSid,
    contentVariables: JSON.stringify(template.variables),
    statusCallback: opts?.statusCallback,
  });
  return { sid: msg.sid, status: msg.status };
}

/** Sends an email through Resend. Returns the Resend email id (null if Resend gave none). */
export async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[],
  headers?: Record<string, string>
): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from   = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

  const { data, error } = await resend.emails.send({ from, to, subject, html, attachments, headers });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "resend send failed", err: error.message }));
    throw new Error(error.message);
  }
  // The Resend email id; delivery webhooks report status against it.
  return data?.id ?? null;
}

export async function sendTenantInviteEmail(opts: {
  to: string;
  tenantName: string;
  propertyName: string;
  inviteUrl: string;
  landlordName: string;
  locale?: string | null;
}): Promise<void> {
  const { lang, t } = emailT(opts.locale);
  const vars = { name: opts.tenantName, property: opts.propertyName, landlord: opts.landlordName };
  const html = emailLayout({
    lang,
    heading: t("invite.heading"),
    paragraphs: [
      opts.tenantName ? t("invite.greeting", vars) : t("invite.greetingNoName"),
      opts.landlordName ? t("invite.bodyFrom", vars) : t("invite.body", vars),
      t("invite.how"),
    ],
    cta: { label: t("invite.cta"), url: opts.inviteUrl },
    note: t("invite.expires"),
    footer: t("footerAuto"),
  });
  await sendResendEmail(opts.to, t("invite.subject", vars), html);
}

/** Lease-ending reminder for the landlord, in their language. */
export function buildExpiryNotification(opts: {
  tenantName: string;
  propertyName: string;
  daysLeft: number;
  contractUrl: string;
  locale?: string | null;
}): { sms: string; subject: string; emailHtml: string } {
  const { lang, t } = emailT(opts.locale);
  const vars = { property: opts.propertyName, tenant: opts.tenantName || "none", days: opts.daysLeft, url: opts.contractUrl };
  return {
    sms: t("expiry.sms", vars),
    subject: t("expiry.subject", vars),
    emailHtml: emailLayout({
      lang,
      heading: t("expiry.heading"),
      paragraphs: [t("expiry.greeting"), t("expiry.body", vars)],
      cta: { label: t("expiry.cta"), url: opts.contractUrl },
      footer: t("expiry.footer"),
    }),
  };
}
