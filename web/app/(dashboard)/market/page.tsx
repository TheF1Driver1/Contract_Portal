"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import MapFilters from "@/components/MapFilters"

const MarketMap = dynamic(() => import("@/components/MarketMap"), { ssr: false })

export default function MarketPage() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Property Market</h1>
        <p className="text-sm text-muted-foreground">Zillow listings in Puerto Rico</p>
      </div>
      <MapFilters onSearch={setFilters} />
      <div className="h-[600px] rounded-lg overflow-hidden border">
        <MarketMap filters={filters} />
      </div>
    </div>
  )
}
