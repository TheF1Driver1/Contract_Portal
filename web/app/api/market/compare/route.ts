import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: contracts } = await supabase
    .from("contracts")
    .select("rent_amount, property:properties(city)")
    .eq("owner_id", user.id)
    .eq("status", "signed")

  const { data: market } = await supabase
    .from("zillow_market")
    .select("city, price")
    .eq("home_status", "FOR_SALE")
    .not("price", "is", null)
    .not("city", "is", null)

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
