import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";

const BUCKET = "contract-templates";

// PATCH /api/templates/[id] — set as default
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  // Verify ownership
  const { data: tmpl, error: fetchErr } = await supabase
    .from("contract_templates")
    .select("id, owner_id, contract_type")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (fetchErr || !tmpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // If promoting to default, demote existing default for same type
  if (body.is_default === true) {
    await supabase
      .from("contract_templates")
      .update({ is_default: false })
      .eq("owner_id", user.id)
      .eq("contract_type", tmpl.contract_type)
      .eq("is_default", true);
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_default === "boolean") updates.is_default = body.is_default;
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.description === "string" || body.description === null) {
    updates.description = body.description;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("contract_templates")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json(updated);
}

// DELETE /api/templates/[id] — remove template + storage file
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: tmpl, error: fetchErr } = await supabase
    .from("contract_templates")
    .select("id, owner_id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (fetchErr || !tmpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const storagePath = `${user.id}/${params.id}.docx`;
  await supabase.storage.from(BUCKET).remove([storagePath]);

  await supabase.from("contract_templates").delete().eq("id", params.id);

  return new NextResponse(null, { status: 204 });
}
