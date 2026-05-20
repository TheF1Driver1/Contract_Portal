import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { ContractCustomSectionUpdateSchema } from "@/lib/schemas";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = ContractCustomSectionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contract_custom_sections")
    .update(parsed.data)
    .eq("id", params.sectionId)
    .eq("contract_id", params.id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const { error } = await supabase
    .from("contract_custom_sections")
    .delete()
    .eq("id", params.sectionId)
    .eq("contract_id", params.id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
