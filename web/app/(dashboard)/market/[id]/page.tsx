import { createClient } from "@/lib/supabase-server"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import WatchlistButton from "@/components/WatchlistButton"

export default async function MarketPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("zillow_market").select("*").eq("id", params.id).single()

  if (!data) return <p>Listing not found.</p>

  const { data: saved } = user
    ? await supabase.from("watchlist").select("id").eq("owner_id", user.id).eq("zillow_id", params.id).single()
    : { data: null }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/market" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Market
      </Link>
      {data.img_src && <img src={data.img_src} alt={data.street} className="rounded-xl w-full h-64 object-cover" />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.street}, {data.city}, {data.state} {data.zipcode}</h1>
          <p className="text-3xl font-bold mt-2">{data.price ? formatCurrency(data.price) : "Price unavailable"}</p>
        </div>
        {user && <WatchlistButton property={data} saved={!!saved} />}
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-2xl font-semibold">{data.beds ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Bedrooms</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-2xl font-semibold">{data.baths ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Bathrooms</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-2xl font-semibold">{data.days_on_zillow ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Days listed</p>
        </div>
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Status: {data.home_status}</p>
        <p>Type: {data.home_type}</p>
      </div>
      {data.detail_url && (
        <a href={data.detail_url} target="_blank" rel="noopener noreferrer"
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          View on Zillow →
        </a>
      )}
    </div>
  )
}
