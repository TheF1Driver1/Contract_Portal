# Task: Market Analytics Widget

## Files to modify
- `web/app/(dashboard)/dashboard/page.tsx`
- `web/app/api/market/properties/route.ts`

## Files to create
- `web/app/api/market/stats/route.ts`
- `web/components/MarketStatsWidget.tsx`

## Install
None. recharts already installed.

## Context
Dashboard already has cashflow graph. Add market stats card below it pulling from `rea.zillow_unique`.
Stats useful to landlords: avg price by city, avg days on market, price per bed.

## Changes

### Create `web/app/api/market/stats/route.ts`
```typescript
import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data, error } = await (supabase as any).schema("rea")
    .from("zillow_unique")
    .select("city, price, beds, days_on_zillow, home_status")
    .not("price", "is", null)
    .eq("home_status", "FOR_SALE")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by city
  const cityMap: Record<string, { prices: number[]; days: number[]; count: number }> = {}
  for (const row of data) {
    if (!row.city) continue
    if (!cityMap[row.city]) cityMap[row.city] = { prices: [], days: [], count: 0 }
    if (row.price) cityMap[row.city].prices.push(row.price)
    if (row.days_on_zillow) cityMap[row.city].days.push(row.days_on_zillow)
    cityMap[row.city].count++
  }

  const stats = Object.entries(cityMap)
    .map(([city, { prices, days, count }]) => ({
      city,
      count,
      avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      avg_days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    }))
    .filter(s => s.avg_price)
    .sort((a, b) => (b.avg_price ?? 0) - (a.avg_price ?? 0))
    .slice(0, 6)

  return NextResponse.json(stats)
}
```

### Create `web/components/MarketStatsWidget.tsx`
```tsx
"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"

export default function MarketStatsWidget() {
  const [stats, setStats] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/market/stats").then(r => r.json()).then(d => setStats(Array.isArray(d) ? d : []))
  }, [])

  if (!stats.length) return null

  return (
    <div className="bg-card rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Market Avg Price by City</h3>
        <span className="text-xs text-muted-foreground">FOR_SALE · Zillow</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="city" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <Bar dataKey="avg_price" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.slice(0, 3).map(s => (
          <div key={s.city} className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground truncate">{s.city}</p>
            <p className="font-semibold text-sm">{s.avg_price ? formatCurrency(s.avg_price) : "—"}</p>
            <p className="text-xs text-muted-foreground">{s.avg_days ?? "—"}d avg</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### `web/app/(dashboard)/dashboard/page.tsx`
Add below the cashflow chart:
```tsx
import MarketStatsWidget from "@/components/MarketStatsWidget"

// In JSX after cashflow block:
<MarketStatsWidget />
```

## Done
- Dashboard shows bar chart of avg listing price per top city
- Summary cards below chart: city, avg price, avg days on market
- Data from `rea.zillow_unique`, FOR_SALE only
- Works in dark mode (CSS vars)
