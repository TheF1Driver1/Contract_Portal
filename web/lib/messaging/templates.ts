// Message templates: one name per kind of notice, rendered in the
// recipient's language for email (subject + HTML) and SMS (plain text), and
// mapped to an approved WhatsApp Content template when one is configured.
// Copy lives in messages/{es,en}/emails.json.
import { emailLayout } from "@/lib/emails/layout";
import { emailT, type MessageLocale } from "@/lib/emails/translator";

export const TEMPLATES = [
  "rent_reminder",
  "rent_overdue",
  "contract_ready_to_sign",
  "contract_signed",
  "lease_ending",
  "receipt",
  "landlord_digest",
] as const;
export type TemplateName = (typeof TEMPLATES)[number];

export type ListItem = Record<string, string>;
export type TemplateVars = Record<string, string | number | boolean | null | undefined | ListItem[]>;

export type Rendered = { subject: string; html: string; text: string };

type T = ReturnType<typeof emailT>["t"];
type Scalars = Record<string, string | number>;

function scalars(vars: TemplateVars): Scalars {
  const out: Scalars = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === "string" || typeof v === "number") out[k] = v;
  }
  return out;
}

const list = (v: TemplateVars[string]): ListItem[] => (Array.isArray(v) ? v : []);
const str = (v: TemplateVars[string]): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

type Builder = (t: T, v: Scalars, raw: TemplateVars, lang: MessageLocale) => {
  subject: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  note?: string;
  footer: string;
  text: string;
};

const BUILDERS: Record<TemplateName, Builder> = {
  rent_reminder: (t, v) => ({
    subject: t("rentReminder.subject", v),
    heading: t("rentReminder.heading"),
    paragraphs: [t("rentReminder.body", v), t("rentReminder.how", v)],
    footer: t("rentReminder.footer"),
    text: t("rentReminder.sms", v),
  }),
  rent_overdue: (t, v) => ({
    subject: t("rentOverdue.subject", v),
    heading: t("rentOverdue.heading"),
    paragraphs: [t("rentOverdue.body", v), t("rentOverdue.how", v)],
    footer: t("rentOverdue.footer"),
    text: t("rentOverdue.sms", v),
  }),
  contract_ready_to_sign: (t, v) => ({
    subject: t("signRequest.subject", v),
    heading: t("signRequest.heading"),
    paragraphs: [t("signRequest.greeting", v), t("signRequest.body", v)],
    cta: { label: t("signRequest.cta"), url: String(v.url) },
    note: v.date ? t("signRequest.expires", v) : undefined,
    footer: t("footerAuto"),
    text: t("signRequest.sms", v),
  }),
  contract_signed: (t, v) => ({
    subject: t("sealed.subject", v),
    heading: t("sealed.heading"),
    paragraphs: [t("sealed.body", v)],
    cta: v.url ? { label: t("sealed.cta"), url: String(v.url) } : undefined,
    note: v.hash ? t("sealed.note", v) : undefined,
    footer: t("footerAuto"),
    text: t("sealed.subject", v),
  }),
  lease_ending: (t, v) => {
    const vars = { ...v, tenant: v.tenant || "none" };
    return {
      subject: t("expiry.subject", vars),
      heading: t("expiry.heading"),
      paragraphs: [t("expiry.greeting"), t("expiry.body", vars)],
      cta: { label: t("expiry.cta"), url: String(v.url) },
      footer: t("expiry.footer"),
      text: t("expiry.sms", vars),
    };
  },
  receipt: (t, v, raw) => ({
    subject: t("receipt.subject", v),
    heading: t("receipt.heading"),
    paragraphs: [t("receipt.body", v), ...(raw.showBalance ? [t("receipt.balance", v)] : [])],
    footer: t("receipt.footer"),
    text: t("receipt.subject", v),
  }),
  landlord_digest: (t, v, raw) => {
    const overdue = list(raw.overdue);
    const payments = list(raw.payments);
    const pending = list(raw.pending);
    const count = overdue.length + payments.length + pending.length;
    const block = (title: string, items: ListItem[], line: (i: ListItem) => string) =>
      items.length ? [title, ...items.map(line)] : [];
    return {
      subject: t("digest.subject", { count }),
      heading: t("digest.heading"),
      paragraphs: [
        t("digest.intro"),
        ...block(t("digest.overdue", { count: overdue.length }), overdue, (i) => t("digest.line", i)),
        ...block(t("digest.payments", { count: payments.length }), payments, (i) => t("digest.line", i)),
        ...block(t("digest.pending", { count: pending.length }), pending, (i) => t("digest.pendingLine", i)),
      ],
      cta: { label: t("digest.cta"), url: str(raw.url) },
      footer: t("digest.footer"),
      text: t("digest.subject", { count }),
    };
  },
};

export function renderMessage(template: TemplateName, locale: string | null | undefined, vars: TemplateVars): Rendered {
  const { lang, t } = emailT(locale);
  const b = BUILDERS[template](t, scalars(vars), vars, lang);
  return {
    subject: b.subject,
    text: b.text,
    html: emailLayout({ lang, heading: b.heading, paragraphs: b.paragraphs, cta: b.cta, note: b.note, footer: b.footer }),
  };
}

// ── WhatsApp (approved Content templates) ──────────────────────────────────
// Business-initiated WhatsApp messages must use a template Meta approved.
// Each template's body takes these variables, in order, as {{1}}, {{2}}, …
export const WHATSAPP_VARIABLES: Partial<Record<TemplateName, string[]>> = {
  rent_reminder: ["name", "amount", "date", "property"],
  rent_overdue: ["name", "amount", "date", "property"],
  contract_ready_to_sign: ["name", "landlord", "property", "url"],
  contract_signed: ["property"],
  lease_ending: ["property", "days", "url"],
  receipt: ["name", "amount", "date", "number"],
};

/** Env var holding the Content SID, e.g. TWILIO_WA_TEMPLATE_RENT_REMINDER_ES. */
export const whatsappEnvVar = (template: TemplateName, locale: string | null | undefined) =>
  `TWILIO_WA_TEMPLATE_${template.toUpperCase()}_${locale === "en" ? "EN" : "ES"}`;

export function whatsappTemplate(
  template: TemplateName,
  locale: string | null | undefined,
  vars: TemplateVars,
  env: Record<string, string | undefined> = process.env
): { contentSid: string; variables: Record<string, string> } | null {
  const names = WHATSAPP_VARIABLES[template];
  const contentSid = env[whatsappEnvVar(template, locale)];
  if (!names || !contentSid || !env.TWILIO_WHATSAPP_FROM) return null;
  return { contentSid, variables: Object.fromEntries(names.map((n, i) => [String(i + 1), str(vars[n]) || "—"])) };
}
