# Task: Market List View + Property Detail

## Files to modify
- `web/app/(dashboard)/market/page.tsx`
- `web/components/MarketMap.tsx`

## Files to create
- `web/components/MarketListView.tsx`
- `web/app/(dashboard)/market/[id]/page.tsx`

## Install
None.

## Context
`/market` currently shows only a Leaflet map. `rea.zillow_unique` has 1454 rows with:
`id, price, beds, baths, street, city, state, zipcode, latitude, longitude, img_src, detail_url, home_type, home_status, days_on_zillow`

API route already exists: `GET /api/market/properties?city=&min_price=&max_price=&beds=`

## Changes

### `web/components/MarketMap.tsx`
Move fetch logic out — accept `properties` as prop instead of fetching internally:
```tsx
export default function MarketMap({ properties }: { properties: MarketProperty[] }) {
  return <Map properties={properties} />
}
```
Page now owns the fetch and passes data to both Map and List.

### Create `web/components/MarketListView.tsx`
```tsx
"use client"
import type { MarketProperty } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export default function MarketListView({ properties }: { properties: MarketProperty[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map(p => (
        <Link key={p.id} href={`/market/${p.id}`}
          className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
          {p.img_src && <img src={p.img_src} alt={p.street ?? ""} className="h-40 w-full object-cover" />}
          <div className="p-4">
            <p className="font-semibold text-lg">{p.price ? formatCurrency(p.price) : "—"}</p>
            <p className="text-sm text-muted-foreground">{p.beds ?? "—"} bd · {p.baths ?? "—"} ba</p>
            <p className="text-sm truncate">{p.street}, {p.city}</p>
            <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{p.home_type}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

### `web/app/(dashboard)/market/page.tsx`
Refactor to own the fetch + add Map/List toggle:
```tsx
"use client"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import MapFilters from "@/components/MapFilters"
import MarketListView from "@/components/MarketListView"
import type { MarketProperty } from "@/lib/types"

const MarketMap = dynamic(() => import("@/components/MarketMap"), { ssr: false })

export default function MarketPage() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [properties, setProperties] = useState<MarketProperty[]>([])
  const [view, setView] = useState<"map" | "list">("map")

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v) as [string,string][])
    fetch(`/api/market/properties?${params}`).then(r => r.json()).then(d => setProperties(Array.isArray(d) ? d : []))
  }, [filters])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Property Market</h1>
          <p className="text-sm text-muted-foreground">{properties.length} listings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("map")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === "map" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>Map</button>
          <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === "list" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>List</button>
        </div>
      </div>
      <MapFilters onSearch={setFilters} />
      {view === "map"
        ? <div className="h-[600px] rounded-lg overflow-hidden border"><MarketMap properties={properties} /></div>
        : <MarketListView properties={properties} />
      }
    </div>
  )
}
```

### Create `web/app/(dashboard)/market/[id]/page.tsx`
```tsx
import { createClient } from "@/lib/supabase-server"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function MarketPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data } = await (supabase as any).schema("rea")
    .from("zillow_unique").select("*").eq("id", params.id).single()

  if (!data) return <p>Listing not found.</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/market" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Market
      </Link>
      {data.img_src && <img src={data.img_src} alt={data.street} className="rounded-xl w-full h-64 object-cover" />}
      <h1 className="text-2xl font-semibold">{data.street}, {data.city}, {data.state} {data.zipcode}</h1>
      <p className="text-3xl font-bold">{data.price ? formatCurrency(data.price) : "Price unavailable"}</p>
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
```

## Done
- `/market` has Map/List toggle; both use same fetched data
- List view shows photo cards with price, beds/baths, address, home_type badge
- `/market/[id]` shows full detail: image, price, stats, Zillow link
- Count of results shown in header
