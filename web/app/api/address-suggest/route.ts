import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";

interface NominatimResult {
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ContractPortal/1.0 (real-estate lease management)" },
    });
    if (!res.ok) return NextResponse.json([]);

    const raw: NominatimResult[] = await res.json();
    const suggestions = raw.map((r) => {
      const a = r.address;
      const houseNum = a.house_number ? `${a.house_number} ` : "";
      const street   = a.road ? `${houseNum}${a.road}` : "";
      const city     = a.city ?? a.town ?? a.village ?? a.county ?? "";
      const state    = a.state ?? "";
      const zip      = a.postcode ?? "";
      const country  = a.country_code?.toUpperCase() ?? a.country ?? "";
      return { display_name: r.display_name, street, city, state, zip, country };
    });

    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
