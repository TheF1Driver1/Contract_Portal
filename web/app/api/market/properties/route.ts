import { createClient } from "@/lib/supabase-server";
import { rateLimitPublic } from "@/lib/rate-limit";
import { MarketPropertiesQuerySchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limited = await rateLimitPublic(ip);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const parsed = MarketPropertiesQuerySchema.safeParse({
    city: searchParams.get("city") ?? undefined,
    min_price: searchParams.get("min_price") ?? undefined,
    max_price: searchParams.get("max_price") ?? undefined,
    beds: searchParams.get("beds") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  let query = supabase
    .from("zillow_market")
    .select(
      "id,price,beds,baths,street,city,state,zipcode,latitude,longitude,imgSrc,detailUrl,homeType,homeStatus,daysOnZillow,original_price,num_price_cuts,price_cut_pct,last_cut_date,desperation_score"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (parsed.data.city) query = query.ilike("city", `%${parsed.data.city}%`);
  if (parsed.data.min_price) query = query.gte("price", parsed.data.min_price);
  if (parsed.data.max_price) query = query.lte("price", parsed.data.max_price);
  if (parsed.data.beds) query = query.gte("beds", parsed.data.beds);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
