import { createClient } from "@/lib/supabase-server"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, Bed, Bath, Clock, ExternalLink } from "lucide-react"
import WatchlistButton from "@/components/WatchlistButton"

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
      {data.img_src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.img_src}
          alt={data.street ?? "Property"}
          className="h-64 w-full rounded-2xl object-cover"
        />
      )}

      {/* Price + address */}
      <div className="surface-card space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {data.home_type ?? "Property"}
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
        <StatCard icon={<Clock className="h-4 w-4" />} value={data.days_on_zillow ?? "—"} label="Days listed" />
      </div>

      {/* Meta */}
      <div className="surface-card space-y-2">
        <InfoRow label="Status" value={data.home_status} />
        <InfoRow label="Type"   value={data.home_type} />
      </div>

      {/* CTA */}
      {data.detail_url && (
        <a
          href={data.detail_url}
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
