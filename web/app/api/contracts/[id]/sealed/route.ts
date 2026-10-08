import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { BUCKET } from "@/lib/esign/service";

/** Short-lived download link for the sealed (signed + certificate) PDF. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // RLS: only the owner (or a manager with access) can read the row.
  const { data: contract } = await supabase.from("contracts").select("sealed_pdf_path").eq("id", id).maybeSingle();
  if (!contract?.sealed_pdf_path) return NextResponse.json({ error: "Este contrato no tiene copia sellada." }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(contract.sealed_pdf_path, 120, {
    download: `contrato-firmado-${id.slice(-8).toUpperCase()}.pdf`,
  });
  if (error || !data) return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, 303);
}
