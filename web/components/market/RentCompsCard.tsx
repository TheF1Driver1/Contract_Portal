"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { LeaseRentComp } from "@/lib/market/comps";

/** Below this absolute difference we call the rent "in line" with the market. */
const IN_LINE_PCT = 2.5;

/**
 * Each signed lease's rent next to the median Zillow rent estimate in the
 * same municipality, with the sample size. Comps are withheld when the API
 * found fewer than its minimum.
 */
export default function RentCompsCard() {
  const t = useTranslations("market.rentComps");
  const f = useFormatter();
  const [data, setData] = useState<{ comps: LeaseRentComp[]; min_comps: number } | null>(null);

  useEffect(() => {
    fetch("/api/market/compare")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && Array.isArray(d.comps) ? d : null))
      .catch(() => setData(null));
  }, []);

  if (!data?.comps.length) return null;
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="space-y-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="rent-comps-title">
      <div>
        <h2 id="rent-comps-title" className="text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="divide-y">
        {data.comps.map((c) => {
          const diff = c.diff_pct;
          const verdict =
            diff == null ? null
            : Math.abs(diff) < IN_LINE_PCT ? t("inLine")
            : diff > 0 ? t("above", { pct: f.number(diff, { maximumFractionDigits: 1 }) })
            : t("below", { pct: f.number(Math.abs(diff), { maximumFractionDigits: 1 }) });
          return (
            <li key={c.contract_id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.property ?? c.city}</p>
                <p className="text-xs text-muted-foreground">{c.city}</p>
              </div>
              <div className="text-right">
                <p className="tabular font-medium text-foreground">
                  <span className="sr-only">{t("yourRent")}: </span>
                  {money(c.rent)}
                </p>
                {c.median != null ? (
                  <>
                    <p className="tabular text-xs text-muted-foreground">
                      {t("market", { amount: money(c.median) })} · {t("sample", { count: c.n })}
                    </p>
                    {verdict && <p className="text-xs font-medium text-foreground">{verdict}</p>}
                  </>
                ) : (
                  <p className="text-xs text-subtle-foreground">{t("tooFew", { count: c.n, min: data.min_comps })}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-subtle-foreground">{t("note")}</p>
    </section>
  );
}
