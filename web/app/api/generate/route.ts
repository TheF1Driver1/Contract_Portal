import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { GenerateContractSchema } from "@/lib/schemas";
import { fetchTemplate, renderDocx } from "@/lib/generate-docx";
import { renderContractPdf } from "@/lib/pdf-react";
import type { Contract, Profile } from "@/lib/types";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = GenerateContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { contractId, format, store } = parsed.data;

  // Fetch contract with all relations + snapshots
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*), occupants:contract_occupants(*)")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Fetch landlord profile for document header
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // ── DOCX — editable copy for landlord only ─────────────────────────────────
  if (format === "docx") {
    const host = req.headers.get("host") ?? "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const fallbackUrl = `${protocol}://${host}/templates/contract_template.docx`;

    const templateBuffer = await fetchTemplate(
      supabase,
      user.id,
      contract.contract_type,
      (contract as Contract & { template_id?: string | null }).template_id ?? null,
      fallbackUrl
    );

    if (!templateBuffer.length) {
      return NextResponse.json({ error: "No template available" }, { status: 404 });
    }

    let docxBuffer: Buffer;
    try {
      docxBuffer = renderDocx(templateBuffer, contract as Contract);
    } catch (e) {
      console.error("[generate] docxtemplater error:", e);
      return NextResponse.json({ error: "Template rendering failed" }, { status: 500 });
    }

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="contract_${contractId}.docx"`,
      },
    });
  }

  // ── PDF — programmatic clean document ─────────────────────────────────────
  const pdfBuffer = await renderContractPdf(contract as Contract, profile as Profile | null);

  if (!pdfBuffer) {
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  // Store in Supabase Storage when requested (e.g. before sending email)
  if (store) {
    try {
      const supabaseAdmin = createAdminClient();
      const storagePath = `${user.id}/${contractId}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("contracts")
        .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        const { data: signedData } = await supabaseAdmin.storage
          .from("contracts")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1-year signed URL
        const pdfUrl = signedData?.signedUrl ?? null;

        await supabase
          .from("contracts")
          .update({ pdf_url: pdfUrl })
          .eq("id", contractId);

        return NextResponse.json({ success: true, pdf_url: pdfUrl });
      }
      console.error("[generate] storage upload error:", uploadError);
    } catch (storeErr) {
      console.error("[generate] store error:", storeErr);
    }
    // Fall through to return buffer as download if storage failed
  }

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contract_${contractId}.pdf"`,
    },
  });
}
