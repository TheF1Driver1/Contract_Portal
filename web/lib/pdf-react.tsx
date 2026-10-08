/**
 * Lease PDF (Spanish, the governing text) rendered with @react-pdf/renderer.
 * Clause wording comes from buildContext() so the PDF and the DOCX template
 * say the same thing. Pure Node.js; no headless browser.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Contract, Profile, Tenant, TenantSnapshot, Property, PropertySnapshot } from "@/lib/types";
import { buildContext, MONTHS_ES } from "@/lib/contract-context";

// ─── formatting ─────────────────────────────────────────────────────────────

export function fechaLarga(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m || !day) return "";
  return `${parseInt(day)} de ${MONTHS_ES[parseInt(m)]} de ${y}`;
}

export function dinero(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── styles (PDF output needs literal colors) ───────────────────────────────

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.55, color: "#111111", paddingTop: 54, paddingBottom: 64, paddingHorizontal: 64 },
  header: { flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: "#555555", marginBottom: 18 },
  title: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: 1.2, marginBottom: 4 },
  subtitle: { textAlign: "center", fontSize: 9, color: "#555555", marginBottom: 18 },
  intro: { marginBottom: 10, textAlign: "justify" },
  clause: { marginBottom: 9 },
  clauseTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 2 },
  para: { textAlign: "justify" },
  notice: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: "#999999", fontSize: 9.5 },
  sigSection: { marginTop: 22 },
  sigGrid: { flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 10 },
  sigBlock: { width: "45%", marginBottom: 14 },
  sigImage: { maxWidth: 200, maxHeight: 50, marginBottom: 2 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#333333", height: 46, marginBottom: 4 },
  sigRole: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 0.6, color: "#444444", marginBottom: 4 },
  sigName: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  sigMeta: { fontSize: 8.5, color: "#555555" },
  footer: { position: "absolute", bottom: 26, left: 64, right: 64, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#888888" },
});

// ─── model ──────────────────────────────────────────────────────────────────

export type PdfSignature = { role: string; name: string; image: string | null; signedAt?: string | null };
interface CustomSection { title: string; body: string }

const AMENITY_LABELS: Record<string, string> = {
  fridge: "nevera",
  stove_count: "estufa(s)",
  microwave: "microondas",
  ac: "aire acondicionado",
  fan_count: "abanico(s) de techo",
  mini_blinds: "cortinas mini-blinds",
  mirror_doors: "puertas de espejo en closets",
  renovated_bathroom: "baño remodelado",
  sofa: "sofá",
  futon: "futón",
  stool_count: "banqueta(s)",
  wall_art: "cuadros",
};

function Clause({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={S.clause} wrap={false}>
      <Text style={S.clauseTitle}>{n}. {title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={S.para}>{children}</Text>;
}

function LeaseDocument({
  contract,
  profile,
  sections,
  signatures,
}: {
  contract: Contract;
  profile: Profile | null;
  sections: CustomSection[];
  signatures?: PdfSignature[];
}) {
  const ctx = buildContext(contract);
  const amenities = (contract.amenities ?? {}) as Record<string, string | number | boolean>;
  const tenant = (contract.tenant_snapshot ?? contract.tenant ?? null) as (TenantSnapshot | Tenant) | null;
  const property = (contract.property_snapshot ?? contract.property ?? null) as (PropertySnapshot | Property) | null;
  const prop = property as Record<string, unknown> | null;
  const ten = tenant as Record<string, unknown> | null;

  const landlordName = (profile?.company_name || profile?.full_name || "").trim() || "________________";
  const tenantName = String(ten?.full_name ?? "") || "________________";
  const address = [prop?.address, contract.unit_number ? `Unidad ${contract.unit_number}` : null, prop?.city, prop?.state, prop?.zip]
    .filter(Boolean)
    .join(", ");
  const contractNo = contract.id.slice(-8).toUpperCase();

  const furnishings = Object.entries(AMENITY_LABELS)
    .map(([key, label]) => {
      const v = amenities[key];
      if (v === true) return label;
      if (typeof v === "number" && v > 0) return `${v} ${label}`;
      return null;
    })
    .filter(Boolean) as string[];
  if (typeof amenities.custom_amenities === "string" && amenities.custom_amenities.trim()) {
    furnishings.push(amenities.custom_amenities.trim());
  }

  const parking = Boolean(prop?.parking_available ?? amenities.parking);
  const coTenants = (contract.occupants ?? []).filter((o) => o.role === "co_tenant").map((o) => o.full_name);
  const occupants = [...(contract.occupant_names ?? []), ...coTenants].filter(Boolean);

  const sigs: PdfSignature[] =
    signatures ??
    [
      { role: "ARRENDADOR(A)", name: landlordName, image: contract.landlord_signature ?? null, signedAt: contract.signed_at },
      { role: "ARRENDATARIO(A)", name: tenantName, image: contract.tenant_signature ?? null, signedAt: contract.signed_at },
    ];

  let n = 0;
  return (
    <Document title={`Contrato de arrendamiento ${contractNo}`} language="es" author="ContractOS">
      <Page size="LETTER" style={S.page}>
        <View style={S.header} fixed>
          <Text>{landlordName}</Text>
          <Text>Contrato núm. {contractNo}</Text>
        </View>

        <Text style={S.title}>CONTRATO DE ARRENDAMIENTO</Text>
        <Text style={S.subtitle}>
          {fechaLarga(contract.lease_start)} al {fechaLarga(contract.lease_end)}
        </Text>

        <Text style={S.intro}>
          De una parte, {landlordName}, en adelante la PARTE ARRENDADORA; y de la otra parte, {tenantName}
          {ten?.license_number ? `, con identificación núm. ${String(ten.license_number)}` : ""}
          {ten?.current_address ? `, con dirección en ${String(ten.current_address)}` : ""}, en adelante la PARTE
          ARRENDATARIA. Ambas partes, con capacidad legal para obligarse, acuerdan el presente contrato sujeto a
          las siguientes cláusulas:
        </Text>

        <Clause n={++n} title="PROPIEDAD">
          <P>
            La PARTE ARRENDADORA arrienda a la PARTE ARRENDATARIA la propiedad ubicada en {address || "________________"}
            {prop?.name ? ` («${String(prop.name)}»)` : ""}, para uso exclusivo de vivienda.
          </P>
        </Clause>

        <Clause n={++n} title="TÉRMINO">
          <P>
            El arrendamiento tendrá una duración de {contract.lease_months} meses, comenzando el{" "}
            {fechaLarga(contract.lease_start)} y terminando el {fechaLarga(contract.lease_end)}.
          </P>
        </Clause>

        <Clause n={++n} title="RENTA">
          <P>
            La renta mensual será de {dinero(contract.rent_amount)}
            {contract.rent_amount_verbal ? ` (${contract.rent_amount_verbal})` : ""}, pagadera no más tarde del día{" "}
            {contract.payment_due_day} de cada mes.
          </P>
        </Clause>

        <Clause n={++n} title="RECARGOS POR ATRASO">
          <P>
            Si la renta no se recibe a tiempo, aplicará un recargo: {ctx.descripcion_mora}.
          </P>
        </Clause>

        <Clause n={++n} title="DEPÓSITO">
          {contract.security_deposit > 0 ? (
            <P>
              A la firma de este contrato, la PARTE ARRENDATARIA entrega un depósito de {dinero(contract.security_deposit)}.{" "}
              {/* Function replacer: a string replacement would read "$1" in "$1,150" as a capture group. */}
              {ctx.deposit_return_policy.replace(/el depósito de seguridad de \$[\d.,]+ /, () => "dicho depósito ")}
            </P>
          ) : (
            <P>No se requiere depósito.</P>
          )}
        </Clause>

        <Clause n={++n} title="OCUPANTES">
          <P>
            La propiedad será ocupada por {contract.occupant_count} persona(s)
            {occupants.length ? `: ${occupants.join(", ")}` : ""}. Cualquier ocupante adicional requiere el
            consentimiento escrito de la PARTE ARRENDADORA.
          </P>
        </Clause>

        <Clause n={++n} title="LLAVES Y ESTACIONAMIENTO">
          <P>
            Se entregan {contract.key_count} llave(s).{" "}
            {parking
              ? `Incluye estacionamiento${prop?.parking_count ? ` para ${String(prop.parking_count)} vehículo(s)` : ""}${amenities.parking_spot ? ` (espacio ${String(amenities.parking_spot)})` : ""}.`
              : "No incluye estacionamiento."}
          </P>
        </Clause>

        {furnishings.length > 0 && (
          <Clause n={++n} title="MOBILIARIO Y ENSERES">
            <P>
              La propiedad se entrega con: {furnishings.join(", ")}. La PARTE ARRENDATARIA los devolverá en el mismo
              estado, salvo el desgaste normal.
            </P>
          </Clause>
        )}

        <Clause n={++n} title="AVISO DE NO RENOVACIÓN">
          <P>{ctx.termination_notice_clause}</P>
        </Clause>

        {sections.map((s) => (
          <Clause key={`${s.title}-${n}`} n={++n} title={s.title.toUpperCase()}>
            <P>{s.body}</P>
          </Clause>
        ))}

        <Clause n={++n} title="LEY APLICABLE">
          <P>
            Este contrato se rige por {ctx.ley_aplicable}. {ctx.no_waiver_clause}
          </P>
        </Clause>

        <Clause n={++n} title="FIRMA ELECTRÓNICA">
          <P>
            Las partes aceptan firmar este contrato y recibir documentos relacionados por medios electrónicos,
            conforme a la Ley 148-2006 de Transacciones Electrónicas de Puerto Rico y la ley federal ESIGN. Las
            firmas electrónicas tienen el mismo efecto que las firmas manuscritas.
          </P>
        </Clause>

        <View style={S.notice}>
          <Text>{ctx.daco_notice}</Text>
          {ctx.lead_paint_notice ? <Text style={{ marginTop: 6 }}>{ctx.lead_paint_notice}</Text> : null}
        </View>

        <View style={S.sigSection} wrap={false}>
          <Text style={S.clauseTitle}>FIRMAS</Text>
          <Text style={S.para}>
            En prueba de conformidad, las partes firman este contrato en la fecha indicada junto a cada firma.
          </Text>
          <View style={S.sigGrid}>
            {sigs.map((s, i) => (
              <View key={`${s.role}-${i}`} style={S.sigBlock}>
                <Text style={S.sigRole}>{s.role}</Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                {s.image ? <Image style={S.sigImage} src={s.image} /> : <View style={S.sigLine} />}
                <Text style={S.sigName}>{s.name}</Text>
                <Text style={S.sigMeta}>Fecha: {s.signedAt ? fechaLarga(s.signedAt) : "____________________"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text>ContractOS · Contrato núm. {contractNo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── public API ─────────────────────────────────────────────────────────────

export async function renderContractPdf(
  contract: Contract,
  profile: Profile | null,
  sections: CustomSection[] = [],
  opts: { signatures?: PdfSignature[] } = {}
): Promise<Buffer | null> {
  try {
    const buf = await renderToBuffer(
      <LeaseDocument contract={contract} profile={profile} sections={sections} signatures={opts.signatures} />
    );
    return Buffer.from(buf);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "lease pdf render failed", err: String(err) }));
    return null;
  }
}
