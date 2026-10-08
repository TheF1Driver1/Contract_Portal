import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bell, FileSignature, FileText, PenLine, Receipt, Landmark, Scale, Languages, Calculator, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/request";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PricingCards } from "./PricingCards";
import { Faq, faqJsonLd } from "./Faq";

const FEATURE_ICONS = [FileText, PenLine, Bell, Receipt, Landmark];
const PR_ICONS = [Scale, Languages, Calculator];

type Item = { title: string; body: string };

export async function Landing({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" });
  const steps = t.raw("steps.items") as Item[];
  const features = t.raw("features.items") as Item[];
  const pr = t.raw("pr.items") as Item[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const pricingHref = locale === "es" ? "/pricing" : "/en/pricing";

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ContractOS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS",
    inLanguage: locale,
    description: t("meta.description"),
    offers: [
      { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Gratis" },
      { "@type": "Offer", price: "29", priceCurrency: "USD", name: "Propietario" },
      { "@type": "Offer", price: "99", priceCurrency: "USD", name: "Inversionista" },
    ],
  };

  return (
    <div lang={locale} className="min-h-screen bg-background text-foreground">
      <SiteHeader locale={locale} />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-soft-foreground">
              <FileSignature className="size-4" aria-hidden />
              {t("hero.eyebrow")}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t("hero.title")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground text-pretty">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/signup">
                  {t("hero.primary")}
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={pricingHref}>{t("hero.secondary")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-subtle-foreground">{t("hero.note")}</p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-surface shadow-md">
            <Image
              src={`/marketing/dashboard-${locale}.png`}
              alt={t("hero.screenshotAlt")}
              width={1366}
              height={900}
              priority
              sizes="(min-width: 1024px) 600px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{t("steps.title")}</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-xl border bg-background p-6">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{t("features.title")}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {features.map((feat, i) => {
              const Icon = FEATURE_ICONS[i] ?? FileText;
              return (
                <div key={feat.title} className="rounded-xl border bg-surface p-5">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 font-semibold">{feat.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feat.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Puerto Rico */}
        <section className="bg-primary-soft">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-primary-soft-foreground sm:text-3xl">{t("pr.title")}</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pr.map((item, i) => {
                const Icon = PR_ICONS[i] ?? Scale;
                return (
                  <div key={item.title} className="rounded-xl bg-surface p-6">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <h3 className="mt-3 font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("pricing.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
          <div className="mt-10">
            <PricingCards locale={locale} />
          </div>
          <p className="mt-6 text-center">
            <Link href={pricingHref} className="text-sm font-medium text-primary hover:underline">
              {t("pricing.cta")} →
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <div className="border-t bg-surface px-4 py-16 md:py-20">
          <Faq id="preguntas" title={t("faq.title")} items={faq} />
        </div>

        {/* Closing CTA */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("cta.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("cta.body")}</p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/signup">{t("cta.button")}</Link>
          </Button>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />
    </div>
  );
}
