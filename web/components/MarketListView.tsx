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
