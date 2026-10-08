import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Heart, ArrowRight, ExternalLink, Calculator, Home } from "lucide-react";
import type { WatchlistItem } from "@/lib/types";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { LabsTitle } from "@/components/market/LabsTitle";
import { MotivationBadge } from "@/components/market/MotivationBadge";
import { Button } from "@/components/ui/button";

export default async function WatchlistPage() {
  const t = await getTranslations("market");
  const f = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("watchlist")
    .select("*")
    .eq("owner_id", user!.id)
    .order("saved_at", { ascending: false });

  const items = (data ?? []) as WatchlistItem[];

  // Fetch live desperation scores from zillow_market
  const zillow_ids = items.map((i) => Number(i.zillow_id)).filter((n) => Number.isFinite(n));
  const scoreMap: Record<string, number | null> = {};
  if (zillow_ids.length > 0) {
    const { data: scores } = await supabase
      .from("zillow_market")
      .select("id,desperation_score")
      .in("id", zillow_ids);
    for (const row of scores ?? []) if (row.id != null) scoreMap[String(row.id)] = row.desperation_score;
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title={<LabsTitle title={t("watchlist.title")} labs={t("labs")} />}
          description={t("watchlist.description", { count: items.length })}
          actions={
            items.length > 0 && (
              <Button asChild variant="outline">
                <Link href="/market">
                  {t("watchlist.browse")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )
          }
        />
        <p className="-mt-3 text-xs text-subtle-foreground">{t("labsNote")}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("watchlist.emptyTitle")}
          description={t("watchlist.emptyDescription")}
          action={
            <Button asChild>
              <Link href="/market">
                {t("watchlist.browse")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col overflow-hidden rounded-xl border bg-surface">
              <div className="relative h-40 bg-surface-muted">
                {/* Listing photos are not hotlinked (Zillow licensing). */}
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="size-8 text-subtle-foreground" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="absolute left-3 top-3">
                  <MotivationBadge score={scoreMap[item.zillow_id]} compact className="shadow-sm" />
                </div>
                {item.detail_url && (
                  <Button
                    asChild
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-3 size-10 rounded-full border bg-surface shadow-sm"
                  >
                    <a href={item.detail_url} target="_blank" rel="noopener noreferrer" aria-label={t("detail.viewListing")}>
                      <ExternalLink aria-hidden />
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.street ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[item.city, item.state].filter(Boolean).join(", ")}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <p className="tabular text-lg font-semibold text-foreground">
                    {item.price ? f.number(item.price, "money") : "—"}
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    {t("bedsBaths", { beds: item.beds ?? "—", baths: item.baths ?? "—" })}
                  </p>
                </div>

                <Button asChild className="mt-auto min-h-10 w-full">
                  <Link href={`/watchlist/${item.id}/analyze`}>
                    <Calculator aria-hidden />
                    {t("watchlist.analyze")}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
