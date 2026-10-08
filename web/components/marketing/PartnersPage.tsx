import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/request";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PARTNER_KINDS } from "@/lib/schemas";
import { PartnerForm, type PartnerCopy } from "./PartnerForm";

const FIELDS = ["title", "name", "email", "phone", "company", "kind", "clients", "message", "messagePlaceholder", "submit", "sending", "sentTitle", "sentBody", "error", "invalid"] as const;

/** /socios and /en/partners (Plan 37): the partner loop for realtors, managers and CPAs. */
export async function PartnersPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "referrals.partners" });
  const copy = {
    ...Object.fromEntries(FIELDS.map((k) => [k, t(`form.${k}`)])),
    kinds: Object.fromEntries(PARTNER_KINDS.map((k) => [k, t(`form.kinds.${k}`)])),
  } as PartnerCopy;
  const who = t.raw("who.items") as string[];
  const steps = t.raw("how.steps") as string[];

  return (
    <div lang={locale} className="min-h-screen bg-background text-foreground">
      <SiteHeader locale={locale} />
      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:py-16">
        <div>
          <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>

          <h2 className="mt-8 text-base font-semibold">{t("who.title")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {who.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {p}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-base font-semibold">{t("how.title")}</h2>
          <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground tabular">
                  {i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-xs text-muted-foreground">
            {t("fine")}{" "}
            <Link href={locale === "es" ? "/terminos" : "/en/terms"} className="text-primary underline underline-offset-4">
              {t("termsLink")}
            </Link>
          </p>
        </div>
        <PartnerForm locale={locale} copy={copy} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
