import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { ContractCustomSectionCreateSchema } from "@/lib/schemas";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("contract_custom_sections")
    .select("*")
    .eq("contract_id", params.id)
    .eq("owner_id", user.id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = ContractCustomSectionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-set order_index to end if not specified
  let orderIndex = parsed.data.order_index ?? 0;
  if (!body.order_index) {
    const { count } = await supabase
      .from("contract_custom_sections")
      .select("*", { count: "exact", head: true })
      .eq("contract_id", params.id);
    orderIndex = count ?? 0;
  }

  const { data, error } = await supabase
    .from("contract_custom_sections")
    .insert({
      contract_id: params.id,
      owner_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
