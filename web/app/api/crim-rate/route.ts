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

  const supabase = createClient();
  const { data, error } = await supabase
    .from("crim_tax_rates")
    .select("municipality, inmueble_rate, mueble_rate, fiscal_year")
    .ilike("municipality", parsed.data.city.trim())
    .eq("fiscal_year", parsed.data.fiscal_year ?? "2025-2026")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Municipality not found" }, { status: 404 });

  return NextResponse.json(data);
}
