import { createAdminClient } from "@/lib/supabase-server";
import { rateLimitPublic } from "@/lib/rate-limit";
import { MarketPropertiesQuerySchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

const COLS = "id,price,beds,baths,street,city,state,zipcode,latitude,longitude,imgSrc,detailUrl,homeType,homeStatus,daysOnZillow,original_price,num_price_cuts,price_cut_pct,last_cut_date,desperation_score";

// ponytail: 1h TTL — Zillow data updates infrequently; bump revalidate if staleness matters
const fetchMarketProperties = unstable_cache(
  async (city: string, min_price: string, max_price: string, beds: string) => {
    const supabase = createAdminClient();
    let query = supabase.from("zillow_market").select(COLS).not("latitude", "is", null).not("longitude", "is", null);
    if (city) query = query.ilike("city", `%${city}%`);
    if (min_price) query = query.gte("price", min_price);
    if (max_price) query = query.lte("price", max_price);
    if (beds) query = query.gte("beds", beds);
    const { data, error } = await query.limit(500);
    return { data, error: error?.message ?? null };
  },
  ["market-properties"],
  { revalidate: 3600, tags: ["market-properties"] }
);

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

  const { city = "", min_price = "", max_price = "", beds = "" } = parsed.data;
  const { data, error } = await fetchMarketProperties(city, min_price, max_price, beds);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}
