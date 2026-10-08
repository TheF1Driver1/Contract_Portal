import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/request";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ContactForm, type ContactCopy } from "./ContactForm";

const FIELDS = ["name", "email", "company", "units", "message", "messagePlaceholder", "submit", "sending", "sentTitle", "sentBody", "error", "invalid"] as const;

export async function ContactPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing.contact" });
  const copy = Object.fromEntries(FIELDS.map((k) => [k, t(`form.${k}`)])) as ContactCopy;
  const points = t.raw("points") as string[];

  return (
    <div lang={locale} className="min-h-screen bg-background text-foreground">
      <SiteHeader locale={locale} />
      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[1fr_1.3fr] md:py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("direct")}{" "}
            <a href="mailto:hola@prcontract.online" className="text-primary underline-offset-4 hover:underline">
              hola@prcontract.online
            </a>
          </p>
        </div>
        <ContactForm locale={locale} copy={copy} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
