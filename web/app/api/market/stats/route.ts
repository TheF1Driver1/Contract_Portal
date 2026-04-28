import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("zillow_market")
    .select("id,city,price,beds,street,state,imgSrc,detailUrl,daysOnZillow,homeStatus,desperation_score,num_price_cuts,price_cut_pct")
    .not("price", "is", null)
    .eq("homeStatus", "FOR_SALE")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cityMap: Record<string, { prices: number[]; days: number[]; scores: number[]; count: number }> = {}
  for (const row of data) {
    if (!row.city) continue
    if (!cityMap[row.city]) cityMap[row.city] = { prices: [], days: [], scores: [], count: 0 }
    if (row.price) cityMap[row.city].prices.push(row.price)
    if (row.daysOnZillow) cityMap[row.city].days.push(row.daysOnZillow)
    if (row.desperation_score != null) cityMap[row.city].scores.push(row.desperation_score)
    cityMap[row.city].count++
  }

  const stats = Object.entries(cityMap)
    .map(([city, { prices, days, scores, count }]) => ({
      city,
      count,
      avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      avg_days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      avg_motivation: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    }))
    .filter(s => s.avg_price)
    .sort((a, b) => (b.avg_price ?? 0) - (a.avg_price ?? 0))
    .slice(0, 6)

  const top_motivated = [...data]
    .filter(r => r.desperation_score != null && r.desperation_score > 0)
    .sort((a, b) => (b.desperation_score ?? 0) - (a.desperation_score ?? 0))
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      street: r.street,
      city: r.city,
      state: r.state,
      price: r.price,
      desperation_score: r.desperation_score,
      num_price_cuts: r.num_price_cuts,
      price_cut_pct: r.price_cut_pct,
    }))

  return NextResponse.json({ stats, top_motivated })
}
