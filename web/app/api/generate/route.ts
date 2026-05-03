import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { GenerateContractSchema } from "@/lib/schemas";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import type { Contract } from "@/lib/types";

export const MONTHS_ES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Markers replaced with signature images after mammoth converts DOCX → HTML
const SIG_LANDLORD = "[[LANDLORD_SIGNATURE]]";
const SIG_TENANT   = "[[TENANT_SIGNATURE]]";

export function check(val: boolean | undefined): string {
  return val ? "✔" : "__________";
}

export function buildContext(contract: Contract) {
  const amenities = (contract.amenities ?? {}) as Record<string, boolean | number>;
  const start  = new Date(contract.lease_start);
  const end    = new Date(contract.lease_end);
  const today  = new Date();

  return {
    dia:  String(today.getDate()),
    mes:  MONTHS_ES[today.getMonth() + 1],
    anio: String(today.getFullYear()),

    nombre_arrendatario: contract.tenant?.full_name ?? "",
    seguro_social:       contract.tenant?.ssn_last4 ? `xxx-xx-${contract.tenant.ssn_last4}` : "xxx-xx-xxxx",
    numero_licencia:     contract.tenant?.license_number ?? "",
    residencia_actual:   contract.tenant?.current_address ?? "",

    cantidad_cuartos:          String(amenities.room_count ?? 1),
    tiene_puertas_de_espejo:   check(Boolean(amenities.mirror_doors)),
    cantidad_abanicos_techo:   String(amenities.fan_count ?? 0),
    tiene_bano_remodelado:     check(Boolean(amenities.renovated_bathroom)),
    cantidad_estufas:          String(amenities.stove_count ?? 1),
    tiene_microondas:          check(Boolean(amenities.microwave)),
    tiene_nevera:              check(Boolean(amenities.fridge)),
    tiene_aire_acondicionado:  check(Boolean(amenities.ac)),
    cantidad_stools:           String(amenities.stool_count ?? 0),
    tiene_cortinas_miniblinds: check(Boolean(amenities.mini_blinds)),
    tiene_sofa:                check(Boolean(amenities.sofa)),
    tiene_futton:              check(Boolean(amenities.futon)),
    tiene_cuadros:             check(Boolean(amenities.wall_art)),
    incluye_estacionamiento:   check(Boolean(amenities.parking)),

    cantidad_personas: String(contract.occupant_count),

    // UTC dates to avoid timezone shift on YYYY-MM-DD strings
    cantidad_de_anios_contrato:  String(Math.floor(contract.lease_months / 12)),
    cantidad_de_meses_contrato:  String(contract.lease_months),
    dia_comienzo_contrato:       String(start.getUTCDate()),
    mes_comienzo_contrato:       MONTHS_ES[start.getUTCMonth() + 1],
    anio_comienzo_contrato:      String(start.getUTCFullYear()),
    dia_que_culmina_contrato:    String(end.getUTCDate()),
    mes_que_culmina_contrato:    MONTHS_ES[end.getUTCMonth() + 1],
    anio_que_culmina_contrato:   String(end.getUTCFullYear()),

    canon_arrendamiento_numero: String(contract.rent_amount),
    canon_arrendamiento_verbal: contract.rent_amount_verbal ?? "",
    cantidad_pago_firma:        String(contract.security_deposit),
    dia_pago_tarde:             String(contract.late_fee_day),

    cantidad_llaves:    String(contract.key_count),
    firma_arrendador:   contract.landlord_signature ? SIG_LANDLORD : "_________________________",
    firma_arrendatario: contract.tenant_signature   ? SIG_TENANT   : "_________________________",
  };
}

// Fetch template buffer: user's custom template from Supabase Storage, or fall back to bundled default
async function fetchTemplate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  contractTypeVal: string,
  templateId: string | null,
  fallbackUrl: string
): Promise<Buffer> {
  // 1. Try specific template assigned to this contract
  if (templateId) {
    const { data: tmpl } = await supabase
      .from("contract_templates")
      .select("file_url")
      .eq("id", templateId)
      .eq("owner_id", userId)
      .single();
    if (tmpl?.file_url) {
      const res = await fetch(tmpl.file_url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  }

  // 2. Try owner's default template for this contract type
  const typeQuery = supabase
    .from("contract_templates")
    .select("file_url")
    .eq("owner_id", userId)
    .eq("is_default", true);

  // prefer exact type, then 'all'
  const { data: exact } = await typeQuery.eq("contract_type", contractTypeVal).single();
  if (exact?.file_url) {
    const res = await fetch(exact.file_url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }

  const { data: all } = await supabase
    .from("contract_templates")
    .select("file_url")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .eq("contract_type", "all")
    .single();
  if (all?.file_url) {
    const res = await fetch(all.file_url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }

  // 3. Bundled default
  const res = await fetch(fallbackUrl);
  if (res.ok) return Buffer.from(await res.arrayBuffer());

  return Buffer.alloc(0);
}

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
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(buildContext(contract as Contract));
    docxBuffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
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
