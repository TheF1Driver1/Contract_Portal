import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { rateLimitPublic } from "@/lib/rate-limit";
import { renderContractPdf } from "@/lib/pdf-react";
import { BUCKET, requestMeta, signerFromToken } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";

/** The lease for review (or the sealed copy once everyone signed). */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const limited = await rateLimitPublic(requestMeta(req).ip ?? "unknown");
  if (limited) return limited;
  const admin = createAdminClient();
  try {
    const { agreement } = await signerFromToken(admin, token);
    const c = agreement.contract;
    let pdf: Buffer | null = null;
    if (c.sealed_pdf_path) {
      const { data } = await admin.storage.from(BUCKET).download(c.sealed_pdf_path);
      pdf = data ? Buffer.from(await data.arrayBuffer()) : null;
    } else {
      pdf = await renderContractPdf(c, agreement.profile, agreement.clauses);
    }
    if (!pdf) return NextResponse.json({ error: "No se pudo generar el documento." }, { status: 500 });
    const name = `contrato-${c.id.slice(-8).toUpperCase()}${c.sealed_pdf_path ? "-firmado" : ""}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    return signErrorResponse(e);
  }
}
