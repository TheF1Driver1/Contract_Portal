import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page:       { padding: 40, fontFamily: "Helvetica", fontSize: 9 },
  header:     { marginBottom: 16, borderBottom: "1pt solid #000", paddingBottom: 8 },
  title:      { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle:   { fontSize: 9, color: "#555" },
  section:    { marginBottom: 16, padding: 10, border: "0.5pt solid #ccc" },
  propName:   { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottom: "0.3pt solid #eee" },
  label:      { flex: 3, color: "#333" },
  amount:     { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTop: "1pt solid #000", marginTop: 4 },
  disclaimer: { fontSize: 7, color: "#999", marginTop: 20, borderTop: "0.5pt solid #eee", paddingTop: 8 },
});

export interface PropertyReport {
  prop: { id: string; name: string; address: string; city: string; state: string };
  totalIncome: number;
  lineItems: Record<number, { label: string; amount: number }>;
  totalExpenses: number;
  netIncome: number;
}

export function ScheduleEDocument({ year, reports }: { year: number; reports: PropertyReport[] }) {
  return (
    <Document>
      {reports.map(({ prop, totalIncome, lineItems, totalExpenses, netIncome }) => (
        <Page key={prop.id} size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule E — Supplemental Income and Loss</Text>
            <Text style={styles.subtitle}>
              Tax Year {year} · For informational purposes only · Prepared by ContractOS
            </Text>
            <Text style={[styles.subtitle, { marginTop: 2 }]}>
              Part I — Income or Loss From Rental Real Estate
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.propName}>{prop.name}</Text>
            <Text style={{ fontSize: 8, color: "#555", marginBottom: 10 }}>
              {prop.address}, {prop.city}, {prop.state}
            </Text>

            <View style={[styles.row, { marginBottom: 6 }]}>
              <Text style={[styles.label, { fontFamily: "Helvetica-Bold" }]}>Line 3 — Rents received</Text>
              <Text style={styles.amount}>${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
            </View>

            {Object.entries(lineItems)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([line, { label, amount }]) => (
                <View key={line} style={styles.row}>
                  <Text style={styles.label}>Line {line} — {label}</Text>
                  <Text style={styles.amount}>${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
                </View>
              ))}

            <View style={styles.totalRow}>
              <Text style={[styles.label, { fontFamily: "Helvetica-Bold" }]}>Total expenses</Text>
              <Text style={styles.amount}>${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.totalRow, { borderTop: "1.5pt solid #000" }]}>
              <Text style={[styles.label, { fontFamily: "Helvetica-Bold", fontSize: 10 }]}>
                {netIncome >= 0 ? "Net rental income" : "Net rental loss"}
              </Text>
              <Text style={[styles.amount, { fontSize: 10, color: netIncome >= 0 ? "#000" : "#cc0000" }]}>
                {netIncome < 0 ? "(" : ""}${Math.abs(netIncome).toLocaleString("en-US", { minimumFractionDigits: 2 })}{netIncome < 0 ? ")" : ""}
              </Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            DISCLAIMER: This report is for informational purposes only and is not a substitute for professional tax advice.
            Figures are based on data entered in ContractOS and may not reflect all deductible expenses or applicable tax rules.
            Please consult a qualified CPA or tax professional before filing your federal income tax return.
            ContractOS is not responsible for any inaccuracies or tax liabilities arising from reliance on this document.
          </Text>
        </Page>
      ))}
    </Document>
  );
}
