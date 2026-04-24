import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// GET — fetch existing analysis for a watchlist item (returns null if none)
export async function GET(
  _req: NextRequest,
  { params }: { params: { watchlistId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("investment_analyses")
    .select("*")
    .eq("owner_id", user.id)
    .eq("watchlist_id", params.watchlistId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

// PUT — upsert analysis inputs
export async function PUT(
  req: NextRequest,
  { params }: { params: { watchlistId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Check if row already exists
  const { data: existing } = await supabase
    .from("investment_analyses")
    .select("id")
    .eq("owner_id", user.id)
    .eq("watchlist_id", params.watchlistId)
    .maybeSingle();

  const payload = {
    owner_id:             user.id,
    watchlist_id:         params.watchlistId,
    purchase_price:       body.purchase_price,
    down_payment_pct:     body.down_payment_pct,
    closing_cost_pct:     body.closing_cost_pct,
    mortgage_rate_pct:    body.mortgage_rate_pct,
    loan_term_years:      body.loan_term_years,
    annual_tax_pct:       body.annual_tax_pct,
    annual_insurance_pct: body.annual_insurance_pct,
    maintenance_pct:      body.maintenance_pct,
    monthly_hoa:          body.monthly_hoa,
    monthly_utilities:    body.monthly_utilities,
    estimated_rent:       body.estimated_rent ?? null,
    vacancy_rate_pct:     body.vacancy_rate_pct,
  };

  let result;
  if (existing?.id) {
    result = await supabase
      .from("investment_analyses")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("investment_analyses")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json(result.data);
}
