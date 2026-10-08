import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING, planFeatures } from "@/lib/pricing";
import { intlLocale, type Locale } from "@/i18n/request";
import { cn } from "@/lib/utils";

/** Plan cards. `signedIn` sends paid plans straight to billing instead of signup. */
export async function PricingCards({ locale, signedIn = false }: { locale: Locale; signedIn?: boolean }) {
  const t = await getTranslations({ locale, namespace: "pricing" });
  const f = await getFormatter({ locale: intlLocale(locale) });
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PRICING.map((p) => {
        const href =
          p.plan === "free"
            ? signedIn ? "/dashboard" : "/signup"
            : signedIn ? `/settings/billing?plan=${p.plan}` : `/signup?plan=${p.plan}`;
        return (
          <section
            key={p.plan}
            aria-labelledby={`plan-${p.plan}`}
            className={cn(
              "relative flex flex-col rounded-xl border bg-surface p-6",
              p.highlighted && "border-primary ring-1 ring-primary"
            )}
          >
            {p.highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {t("mostPopular")}
              </span>
            )}
            <h3 id={`plan-${p.plan}`} className="text-lg font-semibold">{t(`plans.${p.plan}.name`)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(`plans.${p.plan}.description`)}</p>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight tabular">
                {f.number(p.monthly, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm text-muted-foreground">{t("perMonth")}</span>
            </p>
            <Button asChild className="mt-6" variant={p.highlighted ? "default" : "outline"}>
              <Link href={href}>{t(`plans.${p.plan}.cta`)}</Link>
            </Button>
            <ul className="mt-6 space-y-2.5 text-sm">
              {planFeatures(p.plan).map((feat) => (
                <li key={feat.key} className={cn("flex gap-2", !feat.included && "text-subtle-foreground")}>
                  {feat.included ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label={t("compare.included")} />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0" aria-label={t("compare.notIncluded")} />
                  )}
                  {t(`features.${feat.key}`, feat.values)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
