import { createClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ExpenseCreateSchema = z.object({
  property_id: z.string().uuid(),
  category: z.enum(['maintenance','utilities','insurance','taxes','hoa','repairs','management','advertising','mortgage','other']),
  amount: z.number().positive(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  is_tax_deductible: z.boolean().default(true),
  receipt_url: z.string().max(500).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const property_id = searchParams.get("property_id");
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();

  let query = supabase
    .from("property_expenses")
    .select("*, property:properties(id,name)")
    .eq("user_id", user.id)
    .gte("expense_date", `${year}-01-01`)
    .lte("expense_date", `${year}-12-31`)
    .order("expense_date", { ascending: false });

  if (property_id) query = query.eq("property_id", property_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = ExpenseCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("property_expenses")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
