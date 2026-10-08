import { emailLayout } from "@/lib/emails/layout";
import { emailT } from "@/lib/emails/translator";
// Carriers (A2P 10DLC) require brand identification and opt-out instructions.
const SMS_FOOTER = "ContractOS. Responde STOP para cancelar / Reply STOP to opt out.";

export function withSmsFooter(body: string): string {
  return /\bSTOP\b/.test(body) ? body : `${body}\n\n${SMS_FOOTER}`;
}

export async function sendTwilioSms(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) throw new Error("Twilio env vars not configured");

  const twilio = (await import("twilio")).default;
  const client = twilio(sid, token);
  await client.messages.create({ body: withSmsFooter(body), from, to });
}

export async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[],
  headers?: Record<string, string>
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from   = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

  const { error } = await resend.emails.send({ from, to, subject, html, attachments, headers });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "resend send failed", err: error.message }));
    throw new Error(error.message);
  }
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
