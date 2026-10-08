/**
 * Certificate of completion appended to a sealed lease: who signed, when,
 * from where, how identity was checked, and the document fingerprints.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type CertificateSigner = {
  role: string;
  name: string;
  email: string | null;
  phone: string | null;
  verifiedBy: string | null;
  signedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  inPerson: boolean;
};

export type CertificateEvent = { at: string; event: string; actor: string | null; ip: string | null };

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.45, color: "#111111", padding: 48 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 14, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555555", marginBottom: 14 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 1 },
  label: { width: 150, color: "#555555" },
  value: { flex: 1 },
  mono: { fontFamily: "Courier", fontSize: 8 },
  signer: { borderWidth: 1, borderColor: "#cccccc", padding: 8, marginBottom: 6 },
  evRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 2 },
  evAt: { width: 130 },
  evName: { width: 120 },
  evActor: { flex: 1 },
  evIp: { width: 90 },
  note: { marginTop: 14, fontSize: 8, color: "#555555" },
});

const EVENT_ES: Record<string, string> = {
  requested: "Firma solicitada",
  sent: "Enlace enviado",
  viewed: "Documento abierto",
  consented: "Consentimiento electrónico",
  otp_sent: "Código enviado",
  otp_verified: "Identidad verificada",
  otp_failed: "Código incorrecto",
  signed: "Firmado",
  declined: "Rechazado",
  landlord_signed: "Firma del arrendador",
  sealed: "Documento sellado",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-US", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "medium" }) + " (AST)" : "—";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={S.row}>
      <Text style={S.label}>{label}</Text>
      <Text style={mono ? [S.value, S.mono] : S.value}>{value}</Text>
    </View>
  );
}

export async function renderCertificate(opts: {
  contractId: string;
  propertyLabel: string;
  agreementSha256: string;
  leasePdfSha256: string;
  sealedAt: string;
  landlord: { name: string; email: string | null; signedAt: string | null };
  signers: CertificateSigner[];
  events: CertificateEvent[];
}): Promise<Buffer> {
  const doc = (
    <Document title="Certificado de firma electrónica" language="es" author="ContractOS">
      <Page size="LETTER" style={S.page}>
        <Text style={S.title}>Certificado de firma electrónica</Text>
        <Text style={S.subtitle}>Certificate of electronic signature · ContractOS</Text>

        <Row label="Contrato" value={opts.contractId} mono />
        <Row label="Propiedad" value={opts.propertyLabel} />
        <Row label="Sellado" value={when(opts.sealedAt)} />
        <Row label="Huella del acuerdo (SHA-256)" value={opts.agreementSha256} mono />
        <Row label="Huella del contrato PDF (SHA-256)" value={opts.leasePdfSha256} mono />

        <Text style={S.h2}>Firmantes</Text>
        <View style={S.signer}>
          <Row label="Arrendador(a)" value={opts.landlord.name} />
          {opts.landlord.email ? <Row label="Cuenta" value={opts.landlord.email} /> : null}
          <Row label="Firmó" value={when(opts.landlord.signedAt)} />
        </View>
        {opts.signers.map((s, i) => (
          <View key={i} style={S.signer} wrap={false}>
            <Row label={s.role === "tenant" ? "Arrendatario(a)" : s.role === "co_tenant" ? "Co-arrendatario(a)" : "Fiador(a)"} value={s.name} />
            {s.email ? <Row label="Correo" value={s.email} /> : null}
            {s.phone ? <Row label="Teléfono" value={s.phone} /> : null}
            <Row label="Identidad verificada por" value={s.verifiedBy === "sms" ? "Código por SMS" : s.verifiedBy === "email" ? "Código por correo electrónico" : "—"} />
            <Row label="Modalidad" value={s.inPerson ? "En persona, en el dispositivo del arrendador" : "Remota, en el dispositivo del firmante"} />
            <Row label="Firmó" value={when(s.signedAt)} />
            <Row label="Dirección IP" value={s.ip ?? "—"} />
            <Row label="Dispositivo" value={(s.userAgent ?? "—").slice(0, 140)} />
          </View>
        ))}

        <Text style={S.h2}>Registro de eventos</Text>
        {opts.events.map((e, i) => (
          <View key={i} style={S.evRow} wrap={false}>
            <Text style={S.evAt}>{when(e.at)}</Text>
            <Text style={S.evName}>{EVENT_ES[e.event] ?? e.event}</Text>
            <Text style={S.evActor}>{e.actor ?? ""}</Text>
            <Text style={S.evIp}>{e.ip ?? ""}</Text>
          </View>
        ))}

        <Text style={S.note}>
          Las partes consintieron usar documentos y firmas electrónicas (Ley 148-2006 de Transacciones Electrónicas de
          Puerto Rico; ley federal ESIGN). Para verificar este documento, calcule el SHA-256 de las páginas del contrato
          y compárelo con la huella indicada, o solicite la verificación al arrendador.
        </Text>
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
