/** "Recibo de pago": a one-page receipt in the tenant's language. */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { emailT } from "@/lib/emails/translator";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.5, color: "#111111", padding: 56 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#0f766e", marginBottom: 18 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 4 },
  number: { color: "#555555", marginBottom: 20 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 6 },
  label: { width: 150, color: "#555555" },
  value: { flex: 1 },
  amount: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  void: { fontFamily: "Helvetica-Bold", fontSize: 28, color: "#b91c1c", marginBottom: 10 },
  note: { marginTop: 24, fontSize: 8, color: "#555555" },
});

export type ReceiptData = {
  number: number;
  amount: number;
  method: string;
  receivedOn: string;
  reference: string | null;
  tenantName: string;
  landlordName: string;
  property: string;
  leaseLabel: string;
  balanceAfter: number;
  voided: boolean;
  locale: string | null | undefined;
};

export const receiptNumber = (n: number) => `R-${String(n).padStart(6, "0")}`;

export function receiptFormatters(locale: string | null | undefined) {
  const tag = locale === "en" ? "en-US" : "es-US";
  return {
    money: (n: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(n),
    date: (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { dateStyle: "long", timeZone: "UTC" }),
  };
}

export async function renderReceipt(r: ReceiptData): Promise<Buffer> {
  const { lang, t } = emailT(r.locale);
  const f = receiptFormatters(lang);
  const Row = ({ label, value, big }: { label: string; value: string; big?: boolean }) => (
    <View style={S.row}>
      <Text style={S.label}>{label}</Text>
      <Text style={big ? [S.value, S.amount] : S.value}>{value}</Text>
    </View>
  );
  const doc = (
    <Document title={`${t("receipt.pdf.title")} ${receiptNumber(r.number)}`} language={lang} author="ContractOS">
      <Page size="LETTER" style={S.page}>
        <Text style={S.brand}>ContractOS</Text>
        {r.voided ? <Text style={S.void}>{t("receipt.pdf.voided")}</Text> : null}
        <Text style={S.title}>{t("receipt.pdf.title")}</Text>
        <Text style={S.number}>
          {t("receipt.pdf.number")} {receiptNumber(r.number)}
        </Text>
        <Row label={t("receipt.pdf.amount")} value={f.money(r.amount)} big />
        <Row label={t("receipt.pdf.date")} value={f.date(r.receivedOn)} />
        <Row label={t("receipt.pdf.method")} value={t(`receipt.method.${r.method}` as "receipt.method.cash")} />
        {r.reference ? <Row label={t("receipt.pdf.reference")} value={r.reference} /> : null}
        <Row label={t("receipt.pdf.receivedFrom")} value={r.tenantName} />
        <Row label={t("receipt.pdf.receivedBy")} value={r.landlordName} />
        <Row label={t("receipt.pdf.property")} value={r.property} />
        <Row label={t("receipt.pdf.period")} value={r.leaseLabel} />
        <Row label={t("receipt.pdf.balance")} value={f.money(r.balanceAfter)} />
        <Text style={S.note}>{t("receipt.pdf.note")}</Text>
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
