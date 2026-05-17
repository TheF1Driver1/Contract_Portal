import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitRead, rateLimitWrite } from "@/lib/rate-limit";
import { UserSectionTemplateCreateSchema } from "@/lib/schemas";

export async function GET(_req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitRead(user.id);
  if (limited) return limited;

  const { data, error } = await supabase
    .from("user_section_templates")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = UserSectionTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_section_templates")
    .insert({ owner_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
