import { createClient } from "@/lib/supabase-server"
import { getMarketDataUpdatedAt } from "@/lib/market/status"
import Link from "next/link"
import { getFormatter, getTranslations } from "next-intl/server"
import { ArrowLeft, Bed, Bath, Clock, ExternalLink, Home, SearchX, TrendingDown } from "lucide-react"
import WatchlistButton from "@/components/WatchlistButton"
import { EmptyState } from "@/components/app/EmptyState"
import { LabsBadge } from "@/components/market/LabsBadge"
import { MarketFreshness } from "@/components/market/MarketFreshness"
import { MotivationGauge } from "@/components/market/MotivationGauge"
import { MOTIVATION_TONE, motivationLevel } from "@/components/market/motivation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function MarketPropertyPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const t = await getTranslations("market")
  const f = await getFormatter()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, updatedAt] = await Promise.all([
    supabase.from("zillow_market").select("*").eq("id", Number(params.id)).maybeSingle(),
    getMarketDataUpdatedAt(supabase),
  ])

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-10 text-muted-foreground">
      <Link href="/market">
        <ArrowLeft aria-hidden />
        {t("title")}
      </Link>
    </Button>
  )

  if (!data) return (
    <div className="mx-auto max-w-3xl space-y-4">
      {back}
      <EmptyState
        icon={SearchX}
        title={t("detail.notFound")}
        description={t("detail.notFoundDescription")}
        action={<Button asChild><Link href="/market">{t("detail.backToMarket")}</Link></Button>}
      />
    </div>
  )

  const { data: saved } = user
    ? await supabase.from("watchlist").select("id").eq("owner_id", user.id).eq("zillow_id", params.id).single()
    : { data: null }

  const motivation = data.desperation_score ?? 0
  const hasSellerSignals = data.desperation_score != null && data.desperation_score > 0
  const level = motivationLevel(motivation)
  const humanize = (v: string | null | undefined) => (v ? v.replace(/_/g, " ").toLowerCase() : null)
  const address = [data.street, data.city, data.state, data.zipcode].filter(Boolean).join(", ")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}

      {/* Title row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {data.homeType && (
              <span className="text-xs font-medium capitalize text-muted-foreground">{humanize(data.homeType)}</span>
            )}
            <LabsBadge label={t("labs")} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{address || t("detail.property")}</h1>
          <p className="tabular text-2xl font-semibold text-foreground">
            {data.price ? f.number(data.price, "money") : t("detail.noPrice")}
          </p>
        </div>
        {user && <WatchlistButton property={data} saved={!!saved} />}
      </div>
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-subtle-foreground">{t("labsNote")}</p>
        <MarketFreshness updatedAt={updatedAt} />
      </div>

      {/* Listing photos are not hotlinked (Zillow licensing); point to the listing instead. */}
      <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border bg-surface-muted text-center">
        <Home className="size-7 text-subtle-foreground" strokeWidth={1.5} aria-hidden />
        <p className="px-4 text-xs text-muted-foreground">{t("detail.noPhotos")}</p>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-3 gap-3">
        <StatCard icon={<Bed className="size-4" aria-hidden />} value={data.beds ?? "—"} label={t("detail.beds")} />
        <StatCard icon={<Bath className="size-4" aria-hidden />} value={data.baths ?? "—"} label={t("detail.baths")} />
        <StatCard icon={<Clock className="size-4" aria-hidden />} value={data.daysOnZillow ?? "—"} label={t("detail.days")} />
      </dl>

      {/* Seller signals */}
      {hasSellerSignals && (
        <section className="space-y-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="seller-signals-title">
          <div className="flex items-center gap-2">
            <TrendingDown className={cn("size-4", MOTIVATION_TONE[level].text)} aria-hidden />
            <h2 id="seller-signals-title" className="text-base font-semibold text-foreground">{t("detail.signals")}</h2>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("detail.score")}</span>
              <span className="tabular font-semibold text-foreground">
                {t("detail.scoreValue", { score: motivation, level: t(`motivation.levels.${level}`) })}
              </span>
            </div>
            <MotivationGauge score={motivation} label={t("detail.score")} />
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.original_price && data.original_price !== data.price && (
              <InfoRow label={t("detail.originalPrice")} value={f.number(data.original_price, "money")} />
            )}
            {data.price_cut_pct != null && data.price_cut_pct > 0 && (
              <InfoRow label={t("detail.totalCut")} value={`↓ ${data.price_cut_pct}%`} />
            )}
            {data.num_price_cuts != null && data.num_price_cuts > 0 && (
              <InfoRow label={t("detail.cuts")} value={String(data.num_price_cuts)} />
            )}
            {data.last_cut_date && (
              <InfoRow
                label={t("detail.lastCut")}
                value={f.dateTime(
                  new Date(/^\d{4}-\d{2}-\d{2}$/.test(data.last_cut_date) ? data.last_cut_date + "T12:00:00" : data.last_cut_date),
                  { dateStyle: "medium" }
                )}
              />
            )}
          </dl>

          <p className="text-xs text-subtle-foreground">{t("detail.scoreHelp")}</p>
        </section>
      )}

      {/* Meta */}
      <section className="rounded-xl border bg-surface p-4 md:p-5" aria-label={t("detail.details")}>
        <dl className="space-y-2">
          <InfoRow label={t("detail.status")} value={humanize(data.homeStatus)} capitalize />
          <InfoRow label={t("detail.type")} value={humanize(data.homeType)} capitalize />
          {data.rentZestimate != null && data.rentZestimate > 0 && (
            <InfoRow label={t("detail.rentEstimate")} value={f.number(data.rentZestimate, "money")} />
          )}
          {data.homeStatus === "FOR_SALE" && data.price && data.rentZestimate != null && data.rentZestimate > 0 && (
            <InfoRow
              label={t("detail.grossYield")}
              value={`${f.number(((data.rentZestimate * 12) / data.price) * 100, { maximumFractionDigits: 1 })}%`}
            />
          )}
        </dl>
      </section>

      {/* CTA */}
      {data.detailUrl && (
        <Button asChild variant="outline" className="min-h-10">
          <a href={data.detailUrl} target="_blank" rel="noopener noreferrer">
            {t("detail.viewListing")}
            <ExternalLink aria-hidden />
          </a>
        </Button>
      )}
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-surface p-4 text-center">
      {/* Only dt/dd may sit in a <dl> group, so the icon lives inside the dd. */}
      <dd className="tabular order-first flex flex-col items-center gap-1 text-xl font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {value}
      </dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

function InfoRow({ label, value, capitalize }: { label: string; value?: string | null; capitalize?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular font-medium text-foreground", capitalize && "capitalize")}>{value}</dd>
    </div>
  );
}
