import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; attachId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const { data: att, error: fetchErr } = await supabase
    .from("contract_attachments")
    .select("storage_path")
    .eq("id", params.attachId)
    .eq("contract_id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (fetchErr || !att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove from storage
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.storage.from("contracts").remove([att.storage_path]);

  const { error } = await supabase
    .from("contract_attachments")
    .delete()
    .eq("id", params.attachId)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
