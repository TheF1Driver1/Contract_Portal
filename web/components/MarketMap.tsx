"use client"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { MarketProperty } from "@/lib/types"

const Map = dynamic(() => import("./MarketMapInner"), {
  ssr: false,
  loading: () => <div className="h-full bg-muted animate-pulse" />,
})

export default function MarketMap({ filters }: { filters: Record<string, string> }) {
  const [properties, setProperties] = useState<MarketProperty[]>([])

  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    )
    fetch(`/api/market/properties?${params}`)
      .then(r => r.json())
      .then(data => setProperties(Array.isArray(data) ? data : []))
  }, [filters])

  return <Map properties={properties} />
}
