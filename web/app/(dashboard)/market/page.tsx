"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import MapFilters, { type MarketFilters } from "@/components/MapFilters";
import MarketListView from "@/components/MarketListView";
import MarketStatsWidget, { type CityStat } from "@/components/MarketStatsWidget";
import RentCompsCard from "@/components/market/RentCompsCard";
import { MarketFreshness } from "@/components/market/MarketFreshness";
import { MunicipalityYields } from "@/components/market/MunicipalityYields";
import { PageHeader } from "@/components/app/PageHeader";
import { LabsTitle } from "@/components/market/LabsTitle";
import { UpgradeCard } from "@/components/market/UpgradeCard";
import { MotivationBadge } from "@/components/market/MotivationBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MarketProperty } from "@/lib/types";
import type { MunicipalityYield } from "@/lib/market/comps";

interface TopMotivated {
  id: string; street: string | null; city: string | null; state: string | null;
  price: number | null; desperation_score: number | null;
  num_price_cuts: number | null; price_cut_pct: number | null;
}

const MarketMap = dynamic(() => import("@/components/MarketMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const EMPTY: MarketFilters = { city: "", min_price: "", max_price: "", beds: "" };

export default function MarketPage() {
  const t = useTranslations("market");
  const f = useFormatter();
  const locale = useLocale();
  const [filters, setFilters] = useState<MarketFilters>(EMPTY);
  const [properties, setProperties] = useState<MarketProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cityStats, setCityStats] = useState<CityStat[]>([]);
  const [topMotivated, setTopMotivated] = useState<TopMotivated[]>([]);
  const [yields, setYields] = useState<MunicipalityYield[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    );
    fetch(`/api/market/properties?${params}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (r.status === 402) {
          // API message is Spanish; use our own copy for English readers.
          setGated(locale.startsWith("es") && d?.message ? d.message : t("upgrade.message"));
          setProperties([]);
          return;
        }
        setGated(null);
        setProperties(Array.isArray(d) ? d : []);
      })
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, [filters, locale, t]);

  useEffect(() => {
    fetch("/api/market/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.stats) setCityStats(d.stats);
        if (d.top_motivated) setTopMotivated(d.top_motivated);
        if (Array.isArray(d.yields)) setYields(d.yields);
        if (typeof d.updated_at === "string") setUpdatedAt(d.updated_at);
      })
      .catch(() => null);
  }, []);

  const header = (
    <PageHeader
      title={<LabsTitle title={t("title")} labs={t("labs")} />}
      description={t("description")}
      actions={
        !gated && (
          // A two-button toggle: radix Tabs would point aria-controls at panels that don't exist.
          <div role="group" aria-label={t("viewToggle")} className="inline-flex items-center rounded-lg bg-muted p-[3px]">
            {(["map", "list"] as const).map((v) => {
              const Icon = v === "map" ? MapIcon : List;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4",
                    view === v && "bg-surface text-foreground shadow-sm"
                  )}
                >
                  <Icon aria-hidden />
                  {t(`views.${v}`)}
                </button>
              );
            })}
          </div>
        )
      }
    />
  );

  if (gated) {
    return (
      <div>
        {header}
        <UpgradeCard title={t("upgrade.title")} message={gated} cta={t("upgrade.cta")} />
      </div>
    );
  }

  const search = (next: MarketFilters) => {
    setLoading(true);
    setFilters(next);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        {header}
        <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-subtle-foreground">{t("labsNote")}</p>
          <MarketFreshness updatedAt={updatedAt} />
        </div>
      </div>

      {/* Filters: toolbar on desktop, sheet on phones */}
      <div className="hidden rounded-xl border bg-surface p-4 md:block">
        <MapFilters key={JSON.stringify(filters)} initial={filters} onSearch={search} />
      </div>
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="min-h-10">
              <SlidersHorizontal aria-hidden />
              {t("filters.open")}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("filters.title")}</SheetTitle>
              <SheetDescription>{t("filters.description")}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <MapFilters initial={filters} onSearch={search} layout="stacked" />
            </div>
          </SheetContent>
        </Sheet>
        <p className="tabular text-sm text-muted-foreground">{t("listings", { count: properties.length })}</p>
      </div>
      <p className="tabular hidden text-sm text-muted-foreground md:block" aria-live="polite">
        {loading ? t("loading") : t("listings", { count: properties.length })}
      </p>

      {view === "map" ? (
        <div className="h-[60dvh] min-h-80 overflow-hidden rounded-xl border bg-surface md:h-[600px]">
          <MarketMap properties={properties} />
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <MarketListView properties={properties} />
      )}

      {/* Analytics */}
      {(cityStats.length > 0 || topMotivated.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {cityStats.length > 0 && (
            <section className="space-y-3 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="by-city-title">
              <h2 id="by-city-title" className="text-base font-semibold text-foreground">{t("byCity.title")}</h2>
              <ul className="divide-y">
                {cityStats.map((s) => (
                  <li key={s.city} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium text-foreground">{s.city}</span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {s.count != null && <span className="tabular">{t("listings", { count: s.count })}</span>}
                      {s.avg_price != null && (
                        <span className="tabular">{t("byCity.avg", { price: f.number(s.avg_price, "money") })}</span>
                      )}
                      <MotivationBadge score={s.avg_motivation} compact />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topMotivated.length > 0 && (
            <section className="space-y-3 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="top-motivated-title">
              <h2 id="top-motivated-title" className="text-base font-semibold text-foreground">{t("topMotivated.title")}</h2>
              <ul className="divide-y">
                {topMotivated.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/market/${p.id}`}
                      className="-mx-2 flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {[p.street ?? "—", p.city].filter(Boolean).join(", ")}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-muted-foreground">
                          {p.price ? f.number(p.price, "money") : "—"}
                          {p.num_price_cuts != null && p.num_price_cuts > 0 &&
                            ` · ${t("cuts", { count: p.num_price_cuts })} · ↓${p.price_cut_pct}%`}
                        </p>
                      </div>
                      <MotivationBadge score={p.desperation_score} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MarketStatsWidget stats={cityStats} />
        <MunicipalityYields yields={yields} />
        <RentCompsCard />
      </div>
    </div>
  );
}
