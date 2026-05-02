"use client"
import MarketMapInner from "./MarketMapInner"
import type { MarketProperty } from "@/lib/types"

export default function MarketMap({ properties }: { properties: MarketProperty[] }) {
  return <MarketMapInner properties={properties} />
}
