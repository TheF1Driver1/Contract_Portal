import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";
import type { Contract } from "@/lib/types";

// Spanish month names for the existing template format
const MONTHS_ES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function check(val: boolean | undefined): string {
  return val ? "✔" : "__________";
}

function buildContext(contract: Contract) {
  const amenities = (contract.amenities ?? {}) as Record<string, boolean | number>;

  const start = new Date(contract.lease_start);
  const end = new Date(contract.lease_end);
  const today = new Date();

  return {
    // Today
    dia: String(today.getDate()),
    mes: MONTHS_ES[today.getMonth() + 1],
    anio: String(today.getFullYear()),

    // Tenant
    nombre_arrendatario: contract.tenant?.full_name ?? "",
    seguro_social: contract.tenant?.ssn_last4
      ? `xxx-xx-${contract.tenant.ssn_last4}`
      : "xxx-xx-xxxx",
    numero_licencia: contract.tenant?.license_number ?? "",
    residencia_actual: contract.tenant?.current_address ?? "",

    // Property
    cantidad_cuartos: String(amenities.room_count ?? 1),
    tiene_puertas_de_espejo: check(Boolean(amenities.mirror_doors)),
    cantidad_abanicos_techo: String(amenities.fan_count ?? 0),
    tiene_bano_remodelado: check(Boolean(amenities.renovated_bathroom)),
    cantidad_estufas: String(amenities.stove_count ?? 1),
    tiene_microondas: check(Boolean(amenities.microwave)),
    tiene_nevera: check(Boolean(amenities.fridge)),
    tiene_aire_acondicionado: check(Boolean(amenities.ac)),
    cantidad_stools: String(amenities.stool_count ?? 0),
    tiene_cortinas_miniblinds: check(Boolean(amenities.mini_blinds)),
    tiene_sofa: check(Boolean(amenities.sofa)),
    tiene_futton: check(Boolean(amenities.futon)),
    tiene_cuadros: check(Boolean(amenities.wall_art)),
    incluye_estacionamiento: check(Boolean(amenities.parking)),

    // Occupants
    cantidad_personas: String(contract.occupant_count),

    // Contract dates — use UTC methods because date strings ("YYYY-MM-DD") are
    // parsed as UTC midnight; local getDate() would give the wrong day in
    // UTC-offset timezones (e.g. UTC-4 turns Jan 15 00:00 UTC → Jan 14 local).
    cantidad_de_anios_contrato: String(Math.floor(contract.lease_months / 12)),
    cantidad_de_meses_contrato: String(contract.lease_months),
    dia_comienzo_contrato: String(start.getUTCDate()),
    mes_comienzo_contrato: MONTHS_ES[start.getUTCMonth() + 1],
    anio_comienzo_contrato: String(start.getUTCFullYear()),
    dia_que_culmina_contrato: String(end.getUTCDate()),
    mes_que_culmina_contrato: MONTHS_ES[end.getUTCMonth() + 1],
    anio_que_culmina_contrato: String(end.getUTCFullYear()),

    // Payment
    canon_arrendamiento_numero: String(contract.rent_amount),
    canon_arrendamiento_verbal: contract.rent_amount_verbal ?? "",
    cantidad_pago_firma: String(contract.security_deposit),
    dia_pago_tarde: String(contract.late_fee_day),

    // Keys
    cantidad_llaves: String(contract.key_count),

    // Signatures (placeholder — inline image requires server-side docxtpl)
    firma_arrendador: "_________________________",
    firma_arrendatario: "_________________________",
  };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contractId } = await req.json();

  // Fetch contract with joins
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*)")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Look for template file — first check project templates dir, fall back to example
  const templatePaths = [
    path.join(process.cwd(), "templates", "contract_template.docx"),
    path.join(process.cwd(), "..", "CONTRATO_SABANA_GARDENS_prueba.docx"),
  ];

  let templateBuffer: Buffer | null = null;
  for (const p of templatePaths) {
    if (fs.existsSync(p)) {
      templateBuffer = fs.readFileSync(p);
      break;
    }
  }

  if (!templateBuffer) {
    // Generate a minimal plain-text contract if no template found
    return generatePlainContract(contract as Contract);
  }

  try {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(buildContext(contract as Contract));

    const output = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

    return new NextResponse(output as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="contract_${contractId}.docx"`,
      },
    });
  } catch (e) {
    console.error("Docxtemplater error:", e);
    return NextResponse.json({ error: "Template rendering failed" }, { status: 500 });
  }
}

function generatePlainContract(contract: Contract) {
  const ctx = buildContext(contract);

  // Basic contract text
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

AMENITIES
- Refrigerator: ${ctx.tiene_nevera}
- Microwave: ${ctx.tiene_microondas}
- A/C: ${ctx.tiene_aire_acondicionado}
- Parking: ${ctx.incluye_estacionamiento}
- Ceiling fans: ${ctx.cantidad_abanicos_techo}

Occupants: ${ctx.cantidad_personas}

SIGNATURES

Landlord: ${ctx.firma_arrendador}

Tenant: ${ctx.firma_arrendatario}
`;

  // Return as plain text .docx simulation (actually just text — user should add template)
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="contract_${contract.id}.txt"`,
    },
  });
}
