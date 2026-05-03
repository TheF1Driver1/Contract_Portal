import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { GenerateContractSchema } from "@/lib/schemas";
import { buildContext, SIG_LANDLORD, SIG_TENANT } from "@/lib/contract-context";
import { fetchTemplate, renderDocx } from "@/lib/generate-docx";
import mammoth from "mammoth";
import type { Contract } from "@/lib/types";

async function generatePdf(docxBuffer: Buffer, contract: Contract): Promise<Buffer | null> {
  try {
    // DOCX → HTML via mammoth
    const { value: rawHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });

    // Inject signature images where markers appear
    let html = rawHtml;
    const sigStyle = "display:inline-block;max-width:220px;max-height:55px;vertical-align:middle;";
    if (contract.landlord_signature) {
      html = html.replace(
        new RegExp(SIG_LANDLORD.replace(/[[\]]/g, "\\$&"), "g"),
        `<img src="${contract.landlord_signature}" style="${sigStyle}" alt="Landlord signature">`
      );
    }
    if (contract.tenant_signature) {
      html = html.replace(
        new RegExp(SIG_TENANT.replace(/[[\]]/g, "\\$&"), "g"),
        `<img src="${contract.tenant_signature}" style="${sigStyle}" alt="Tenant signature">`
      );
    }

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 2cm 2.5cm; size: Letter; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    margin: 0;
  }
  p { margin: 0 0 0.5em; }
  h1, h2, h3 { font-family: "Times New Roman", Times, serif; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 6px; vertical-align: top; }
  img { display: inline-block; }
</style>
</head>
<body>${html}</body>
</html>`;

    // Detect environment: Vercel Lambda vs local
    const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    const { default: puppeteer } = await import("puppeteer-core");

    let browser;
    if (isVercel) {
      const { default: chromium } = await import("@sparticuz/chromium-min");
      const packUrl =
        process.env.CHROMIUM_PACK_URL ??
        "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromiumAny = chromium as any;
      browser = await puppeteer.launch({
        args: chromiumAny.args ?? [],
        defaultViewport: chromiumAny.defaultViewport ?? { width: 1200, height: 900 },
        executablePath: await chromiumAny.executablePath(packUrl),
        headless: true,
      });
    } else {
      // Local dev: use system Chrome
      const localChrome =
        process.env.CHROMIUM_PATH ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      browser = await puppeteer.launch({
        executablePath: localChrome,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
      });
    }

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "Letter", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("PDF generation failed:", err);
    return null;
  }
}

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
  const { contractId, format } = parsed.data;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*)")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const host     = req.headers.get("host") ?? "localhost:3000";
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
    return generatePlainContract(contract as Contract);
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = renderDocx(templateBuffer, contract as Contract);
  } catch (e) {
    console.error("Docxtemplater error:", e);
    return NextResponse.json({ error: "Template rendering failed" }, { status: 500 });
  }

  // DOCX output
  if (format === "docx") {
    return new NextResponse(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="contract_${contractId}.docx"`,
      },
    });
  }

  // PDF output (default)
  const pdfBuffer = await generatePdf(docxBuffer, contract as Contract);
  if (!pdfBuffer) {
    // Fall back to DOCX if PDF generation fails
    return new NextResponse(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="contract_${contractId}.docx"`,
      },
    });
  }

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contract_${contractId}.pdf"`,
    },
  });
}

function generatePlainContract(contract: Contract) {
  const ctx = buildContext(contract);
  const text = `LEASE AGREEMENT

Date: ${ctx.dia} ${ctx.mes} ${ctx.anio}

TENANT: ${ctx.nombre_arrendatario}
License: ${ctx.numero_licencia}
SSN: ${ctx.seguro_social}
Current Address: ${ctx.residencia_actual}

PROPERTY: ${contract.property?.name ?? ""}
Address: ${contract.property?.address ?? ""}
Unit: ${contract.unit_number ?? "N/A"}
Bedrooms: ${ctx.cantidad_cuartos}

LEASE TERM
Start: ${ctx.dia_comienzo_contrato} ${ctx.mes_comienzo_contrato} ${ctx.anio_comienzo_contrato}
End: ${ctx.dia_que_culmina_contrato} ${ctx.mes_que_culmina_contrato} ${ctx.anio_que_culmina_contrato}
Duration: ${ctx.cantidad_de_meses_contrato} months

PAYMENT
Monthly Rent: $${ctx.canon_arrendamiento_numero} (${ctx.canon_arrendamiento_verbal})
Due: Day ${contract.payment_due_day} of each month
Late after: Day ${ctx.dia_pago_tarde}
Deposit paid at signing: $${ctx.cantidad_pago_firma}
Keys: ${ctx.cantidad_llaves}

Occupants: ${ctx.cantidad_personas}

SIGNATURES

Landlord: ${ctx.firma_arrendador}

Tenant: ${ctx.firma_arrendatario}
`;
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="contract_${contract.id}.txt"`,
    },
  });
}
