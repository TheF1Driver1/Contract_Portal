import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// DELETE /api/managers/[id] — revoke a manager invite
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: record } = await supabase
    .from("property_managers")
    .select("id, status")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("property_managers")
    .update({ status: "revoked" })
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
