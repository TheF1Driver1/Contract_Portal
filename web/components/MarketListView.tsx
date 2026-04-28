"use client"
import type { MarketProperty } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

function motivationBadge(score: number | null) {
  if (score == null || score === 0) return null
  const { label, cls } =
    score >= 61 ? { label: "High Motivation", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" } :
    score >= 41 ? { label: "Moderate", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" } :
    score >= 21 ? { label: "Mild", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" } :
    { label: null, cls: "" }
  if (!label) return null
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label} {score}</span>
}

export default function MarketListView({ properties }: { properties: MarketProperty[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map(p => (
        <Link key={p.id} href={`/market/${p.id}`}
          className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
          {p.imgSrc && <img src={p.imgSrc} alt={p.street ?? ""} className="h-40 w-full object-cover" />}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-lg">{p.price ? formatCurrency(p.price) : "—"}</p>
              {motivationBadge(p.desperation_score)}
            </div>
            <p className="text-sm text-muted-foreground">{p.beds ?? "—"} bd · {p.baths ?? "—"} ba</p>
            <p className="text-sm truncate">{p.street}, {p.city}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{p.homeType}</span>
              {p.num_price_cuts != null && p.num_price_cuts > 0 && (
                <span className="text-xs text-muted-foreground">
                  {p.num_price_cuts} cut{p.num_price_cuts > 1 ? "s" : ""} · ↓{p.price_cut_pct}%
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
