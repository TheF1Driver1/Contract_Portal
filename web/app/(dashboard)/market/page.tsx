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
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])
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
