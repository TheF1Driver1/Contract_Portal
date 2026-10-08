import { requireFeature } from "@/lib/entitlements";
import { MIN_COMPS, rentComps, type LeaseRentComp, type MarketListing } from "@/lib/market/comps";
import { createClient } from "@/lib/supabase-server";
import { rateLimitRead } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * Rent comps: each signed lease's monthly rent vs. the median Zillow
 * rentZestimate (estimated market rent) in the same municipality. Sale
 * prices are not used here. Medians with fewer than MIN_COMPS listings are
 * withheld (n is still returned so the UI can say why).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const gated = await requireFeature(supabase, user.id, "market");
  if (gated) return gated;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, rent_amount, property:properties(name, city)")
    .eq("owner_id", user.id)
    .eq("status", "signed");

  const leases = (contracts ?? [])
    .map((c) => {
      const property = c.property as { name?: string | null; city?: string | null } | null;
      return { id: c.id, rent: Number(c.rent_amount), name: property?.name ?? null, city: property?.city ?? null };
    })
    .filter((l): l is typeof l & { city: string } => !!l.city && Number.isFinite(l.rent) && l.rent > 0);

  if (!leases.length) return NextResponse.json({ comps: [], min_comps: MIN_COMPS });

  // Accent variants ("Bayamon"/"Bayamón") rule out an SQL city filter; the
  // view is small (one row per listing), so match in TS.
  const { data: market } = await supabase
    .from("zillow_market")
    .select("city, beds, price, rentZestimate, homeStatus") // view keeps Zillow camelCase
    .not("rentZestimate", "is", null)
    .not("city", "is", null)
    .limit(5000);

  const listings = (market ?? []) as MarketListing[];
  // Properties carry no bedroom count yet, so comps are municipality-wide.
  const comps: LeaseRentComp[] = leases
    .map((l) => {
      const c = rentComps({ rent: l.rent, city: l.city, beds: null }, listings);
      return {
        contract_id: l.id,
        property: l.name,
        city: l.city,
        rent: l.rent,
        n: c.n,
        median: c.median,
        diff_pct: c.diffPct,
        matched_on: c.matchedOn,
      };
    })
    .sort((a, b) => (a.property ?? a.city).localeCompare(b.property ?? b.city, "es"));

  return NextResponse.json({ comps, min_comps: MIN_COMPS });
}
