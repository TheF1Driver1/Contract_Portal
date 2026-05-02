import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  const fiscalYear = req.nextUrl.searchParams.get("fiscal_year") ?? "2025-2026";

  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("crim_tax_rates")
    .select("municipality, inmueble_rate, mueble_rate, fiscal_year")
    .ilike("municipality", city.trim())
    .eq("fiscal_year", fiscalYear)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Municipality not found" }, { status: 404 });

  return NextResponse.json(data);
}
