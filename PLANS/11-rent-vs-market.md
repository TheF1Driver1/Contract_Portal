# Task: Rent vs Market Comparison

## Files to modify
- `web/app/(dashboard)/dashboard/page.tsx`

## Files to create
- `web/app/api/market/compare/route.ts`
- `web/components/RentVsMarketChart.tsx`

## Install
None. recharts already installed.

## Context
Landlord owns properties in specific cities. Market data in `rea.zillow_unique` has avg prices
by city. Contracts table has `rent_amount` and property city. Compare landlord's rent income
against what similar properties sell/rent for in same cities.

## Changes

### Create `web/app/api/market/compare/route.ts`
```typescript
import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get landlord's active contracts with property city + rent
  const { data: contracts } = await supabase
    .from("contracts")
    .select("rent_amount, property:properties(city)")
    .eq("owner_id", user.id)
    .eq("status", "signed")

  // Get market avg price by city from rea schema
  const { data: market } = await (supabase as any).schema("rea")
    .from("zillow_unique")
    .select("city, price")
    .eq("home_status", "FOR_SALE")
    .not("price", "is", null)
    .not("city", "is", null)

  // Build comparison per city
  const rentByCity: Record<string, number[]> = {}
  for (const c of contracts ?? []) {
    const city = (c.property as any)?.city
    if (!city) continue
    if (!rentByCity[city]) rentByCity[city] = []
    rentByCity[city].push(c.rent_amount)
  }

  const marketByCity: Record<string, number[]> = {}
  for (const m of market ?? []) {
    if (!m.city) continue
    if (!marketByCity[m.city]) marketByCity[m.city] = []
    marketByCity[m.city].push(m.price)
  }

  const cities = Object.keys(rentByCity)
  const comparison = cities.map(city => ({
    city,
    avg_rent: Math.round(rentByCity[city].reduce((a, b) => a + b, 0) / rentByCity[city].length),
    avg_market: marketByCity[city]
      ? Math.round(marketByCity[city].reduce((a, b) => a + b, 0) / marketByCity[city].length)
      : null,
  }))

  return NextResponse.json(comparison)
}
```

### Create `web/components/RentVsMarketChart.tsx`
```tsx
"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"

export default function RentVsMarketChart() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/market/compare").then(r => r.json()).then(d => setData(Array.isArray(d) ? d : []))
  }, [])

  if (!data.length) return null

  return (
    <div className="bg-card rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Your Rent vs Market Price</h3>
      <p className="text-xs text-muted-foreground">Monthly rent (your contracts) vs avg Zillow listing price by city</p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="city" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Legend />
            <Bar dataKey="avg_rent" name="Your Avg Rent" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
            <Bar dataKey="avg_market" name="Market Avg Price" fill="hsl(var(--muted-foreground))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

### `web/app/(dashboard)/dashboard/page.tsx`
Add after MarketStatsWidget:
```tsx
import RentVsMarketChart from "@/components/RentVsMarketChart"
// In JSX:
<RentVsMarketChart />
```

## Done
- Dashboard shows grouped bar: your avg rent vs Zillow avg market price per city
- Only cities where landlord has signed contracts appear
- No data = component returns null (no empty state clutter)
