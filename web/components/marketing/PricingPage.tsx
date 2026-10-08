import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRICING, planFeatures } from "@/lib/pricing";
import type { Locale } from "@/i18n/request";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PricingCards } from "./PricingCards";
import { Faq, faqJsonLd } from "./Faq";

export async function PricingPage({ locale, signedIn }: { locale: Locale; signedIn: boolean }) {
  const t = await getTranslations({ locale, namespace: "pricing" });
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const rows = planFeatures("inversionista").map((f) => f.key);

  return (
    <div lang={locale} className="min-h-screen bg-background text-foreground">
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-12">
          <PricingCards locale={locale} signedIn={signedIn} />
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t("plans.enterprise.name")}</h2>
            <p className="text-sm text-muted-foreground">{t("plans.enterprise.description")}</p>
          </div>
          <Link
            href={locale === "es" ? "/contacto" : "/en/contact"}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-hover"
          >
            {t("plans.enterprise.cta")}
          </Link>
        </div>

        <section className="mt-16" aria-labelledby="compare-title">
          <h2 id="compare-title" className="text-center text-2xl font-semibold tracking-tight">{t("compare.title")}</h2>
          <div className="mt-8 overflow-x-auto rounded-xl border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("compare.feature")}</TableHead>
                  {PRICING.map((p) => (
                    <TableHead key={p.plan} scope="col" className="text-center">{t(`plans.${p.plan}.name`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((key) => (
                  <TableRow key={key}>
                    <TableHead scope="row" className="font-normal text-foreground">
                      {key === "properties" || key === "contracts" || key === "managers"
                        ? t(`compare.rows.${key}`)
                        : t(`features.${key}`)}
                    </TableHead>
                    {PRICING.map((p) => {
                      const feat = planFeatures(p.plan).find((f) => f.key === key)!;
                      const numeric = feat.values?.count;
                      return (
                        <TableCell key={p.plan} className="text-center">
                          {numeric !== undefined && feat.included ? (
                            <span className="tabular">{numeric === -1 ? "∞" : numeric}</span>
                          ) : feat.included ? (
                            <Check className="mx-auto size-4 text-primary" aria-label={t("compare.included")} />
                          ) : (
                            <Minus className="mx-auto size-4 text-subtle-foreground" aria-label={t("compare.notIncluded")} />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="mt-16">
          <Faq id="faq-precios" title={t("faq.title")} items={faq} />
        </div>
      </main>
      <SiteFooter locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />
    </div>
  );
}
