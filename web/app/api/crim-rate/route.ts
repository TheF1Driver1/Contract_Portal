import { findByMunicipality, prFiscalYear } from "@/lib/market/comps";
import { createClient } from "@/lib/supabase-server";
import { rateLimitPublic } from "@/lib/rate-limit";
import { CrimRateQuerySchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limited = await rateLimitPublic(ip);
  if (limited) return limited;

  const city = req.nextUrl.searchParams.get("city");
  const fiscal_year = req.nextUrl.searchParams.get("fiscal_year") ?? undefined;

  const parsed = CrimRateQuerySchema.safeParse({ city, fiscal_year });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 78 municipalities × a few fiscal years: fetch them and match in TS so
  // "Bayamon", "bayamón" and "Bayamón" all find the CRIM row.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crim_tax_rates")
    .select("municipality, inmueble_rate, mueble_rate, fiscal_year")
    .order("fiscal_year", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const wanted = parsed.data.fiscal_year ?? prFiscalYear();
  // Fall back to the latest year on file when the current one is not seeded yet.
  const year = rows.some((r) => r.fiscal_year === wanted) ? wanted : rows[0]?.fiscal_year;
  const match = findByMunicipality(rows.filter((r) => r.fiscal_year === year), parsed.data.city.trim());
  if (!match) return NextResponse.json({ error: "Municipality not found" }, { status: 404 });

  return NextResponse.json(match);
}
