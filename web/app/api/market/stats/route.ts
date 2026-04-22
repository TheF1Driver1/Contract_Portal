import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("zillow_market")
    .select("city, price, beds, days_on_zillow, home_status")
    .not("price", "is", null)
    .eq("home_status", "FOR_SALE")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
