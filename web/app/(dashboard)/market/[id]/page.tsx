import { createClient } from "@/lib/supabase-server"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, Bed, Bath, Clock, ExternalLink, TrendingDown } from "lucide-react"
import WatchlistButton from "@/components/WatchlistButton"

function motivationColor(score: number) {
  if (score >= 61) return "var(--color-red-500, #ef4444)"
  if (score >= 41) return "var(--color-orange-500, #f97316)"
  if (score >= 21) return "var(--color-yellow-500, #eab308)"
  return "var(--text-muted)"
}

export default async function MarketPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("zillow_market").select("*").eq("id", params.id).single()

  if (!data) return (
    <div className="surface-card py-16 text-center">
      <p style={{ color: "var(--text-muted)" }}>Listing not found.</p>
    </div>
  )

  const { data: saved } = user
    ? await supabase.from("watchlist").select("id").eq("owner_id", user.id).eq("zillow_id", params.id).single()
    : { data: null }

  const hasSellerSignals = data.desperation_score != null && data.desperation_score > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/market"
        className="btn-tonal inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Market
      </Link>

      {/* Hero image */}
      {data.imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.imgSrc}
          alt={data.street ?? "Property"}
          className="h-64 w-full rounded-2xl object-cover"
        />
      )}

      {/* Price + address */}
      <div className="surface-card space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {data.homeType ?? "Property"}
            </p>
            <h1
              className="text-2xl font-bold mt-1"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              {[data.street, data.city, data.state, data.zipcode].filter(Boolean).join(", ")}
            </h1>
            <p
              className="text-3xl font-bold mt-2"
              style={{ color: "var(--accent)", letterSpacing: "-0.03em" }}
            >
              {data.price ? formatCurrency(data.price) : "Price unavailable"}
            </p>
          </div>
          {user && <WatchlistButton property={data} saved={!!saved} />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Bed className="h-4 w-4" />} value={data.beds ?? "—"} label="Bedrooms" />
        <StatCard icon={<Bath className="h-4 w-4" />} value={data.baths ?? "—"} label="Bathrooms" />
        <StatCard icon={<Clock className="h-4 w-4" />} value={data.daysOnZillow ?? "—"} label="Days listed" />
      </div>

      {/* Seller Signals */}
      {hasSellerSignals && (
        <div className="surface-card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" style={{ color: motivationColor(data.desperation_score) }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Seller Motivation</p>
          </div>

          {/* Score gauge */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Motivation score</span>
              <span className="font-bold" style={{ color: motivationColor(data.desperation_score) }}>
                {data.desperation_score} / 100
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-container)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(data.desperation_score, 100)}%`,
                  background: motivationColor(data.desperation_score),
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.original_price && data.original_price !== data.price && (
              <InfoRow label="Original price" value={formatCurrency(data.original_price)} />
            )}
            {data.price_cut_pct != null && data.price_cut_pct > 0 && (
              <InfoRow label="Total reduction" value={`↓ ${data.price_cut_pct}%`} />
            )}
            {data.num_price_cuts != null && data.num_price_cuts > 0 && (
              <InfoRow label="Price cuts" value={String(data.num_price_cuts)} />
            )}
            {data.last_cut_date && (
              <InfoRow label="Last cut" value={new Date(data.last_cut_date).toLocaleDateString()} />
            )}
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Score reflects price reduction velocity, recency, and frequency. Higher = more motivated seller.
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="surface-card space-y-2">
        <InfoRow label="Status" value={data.homeStatus} />
        <InfoRow label="Type"   value={data.homeType} />
      </div>

      {/* CTA */}
      {data.detailUrl && (
        <a
          href={data.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary-gradient inline-flex items-center gap-2"
        >
          View on Zillow
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="surface-card flex flex-col items-center gap-1 py-5 text-center">
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
        {value.replace(/_/g, " ").toLowerCase()}
      </span>
    </div>
  )
}
