"use client";
import { useFormatter, useTranslations } from "next-intl";
import type { MunicipalityYield } from "@/lib/market/comps";

/** Gross yield and price-to-rent by municipality (medians, n ≥ MIN_COMPS). */
export function MunicipalityYields({ yields }: { yields: MunicipalityYield[] }) {
  const t = useTranslations("market.yields");
  const f = useFormatter();
  if (!yields.length) return null;
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="space-y-3 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="yields-title">
      <div>
        <h2 id="yields-title" className="text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="divide-y">
        {yields.map((y) => (
          <li key={y.city} className="py-2.5">
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{y.city}</span>
              <span className="tabular text-xs text-muted-foreground">{t("sample", { count: y.n })}</span>
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
              <Metric label={t("price")} value={money(y.medianPrice)} />
              <Metric label={t("rent")} value={money(y.medianRent)} />
              <Metric label={t("grossYield")} value={`${f.number(y.grossYieldPct, { maximumFractionDigits: 1 })}%`} strong />
              <Metric label={t("priceToRent")} value={t("priceToRentValue", { value: f.number(y.priceToRent, { maximumFractionDigits: 1 }) })} />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "tabular font-semibold text-foreground" : "tabular text-foreground"}>{value}</dd>
    </div>
  );
}
