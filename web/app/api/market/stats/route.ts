import { requireFeature } from "@/lib/entitlements";
import { municipalityYields, normalizeMunicipality } from "@/lib/market/comps";
import { getMarketDataUpdatedAt } from "@/lib/market/status";
import { createClient } from "@/lib/supabase-server";
import { rateLimitPublic } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limited = await rateLimitPublic(ip);
  if (limited) return limited;

  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gated = await requireFeature(supabaseUser, user.id, "market");
  if (gated) return gated;

  const supabase = await createClient();
  const [{ data, error }, updated_at] = await Promise.all([
    supabase
      .from("zillow_market")
      .select("id,city,price,beds,street,state,detailUrl,daysOnZillow,homeStatus,rentZestimate,desperation_score,num_price_cuts,price_cut_pct")
      .not("price", "is", null)
      .eq("homeStatus", "FOR_SALE")
      .limit(5000),
    getMarketDataUpdatedAt(supabase),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group accent variants ("Bayamon"/"Bayamón") together; label with the most common spelling.
  type CityAgg = { names: Record<string, number>; prices: number[]; days: number[]; scores: number[]; count: number };
  const cityMap: Record<string, CityAgg> = {};
  for (const row of data) {
    const key = normalizeMunicipality(row.city);
    if (!row.city || !key) continue;
    const agg = (cityMap[key] ??= { names: {}, prices: [], days: [], scores: [], count: 0 });
    agg.names[row.city] = (agg.names[row.city] ?? 0) + 1;
    if (row.price) agg.prices.push(row.price);
    if (row.daysOnZillow) agg.days.push(row.daysOnZillow);
    if (row.desperation_score != null) agg.scores.push(row.desperation_score);
    agg.count++;
  }

  const stats = Object.values(cityMap)
    .map(({ names, prices, days, scores, count }) => ({
      city: Object.entries(names).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0],
      count,
      avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      avg_days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      avg_motivation: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    }))
    .filter(s => s.avg_price)
    .sort((a, b) => (b.avg_price ?? 0) - (a.avg_price ?? 0))
    .slice(0, 6);

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
    }));

  // Gross yield / price-to-rent need a rentZestimate on for-sale listings.
  const yields = municipalityYields(data);

  return NextResponse.json({ stats, top_motivated, yields, updated_at });
}
