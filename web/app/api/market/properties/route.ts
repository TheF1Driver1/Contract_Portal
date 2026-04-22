import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = createClient()

  let query = supabase.from("zillow_market")
    .select("id,price,beds,baths,street,city,state,zipcode,latitude,longitude,img_src,detail_url,home_type,home_status")
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (searchParams.get("city")) query = query.ilike("city", `%${searchParams.get("city")}%`)
  if (searchParams.get("min_price")) query = query.gte("price", searchParams.get("min_price"))
  if (searchParams.get("max_price")) query = query.lte("price", searchParams.get("max_price"))
  if (searchParams.get("beds")) query = query.gte("beds", searchParams.get("beds"))

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
