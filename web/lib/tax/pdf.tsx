/** Year-end package PDF (Plan 35), in the owner's language. Styled like the rent receipt. */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import es from "@/messages/es/tax.json";
import en from "@/messages/en/tax.json";
import { groupLines, type AnnualPackage, type TaxView } from "@/lib/tax/annual";
import { SCHEDULE_E_LINES } from "@/lib/tax/mapping";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, lineHeight: 1.45, color: "#111111", padding: 48 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#0f766e", marginBottom: 14 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.2, marginBottom: 6 },
  sub: { color: "#555555", marginBottom: 12 },
  notice: { borderLeftWidth: 3, borderLeftColor: "#b45309", backgroundColor: "#fffbeb", paddingVertical: 6, paddingHorizontal: 10, marginBottom: 14 },
  noticeTitle: { fontFamily: "Helvetica-Bold", color: "#92400e" },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 11.5, marginTop: 14, marginBottom: 2 },
  muted: { color: "#555555" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingVertical: 4, marginTop: 6 },
  line: { width: 34, color: "#555555" },
  label: { flex: 1, paddingRight: 8 },
  amount: { width: 90, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  total: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#111111", paddingVertical: 4 },
  foot: { marginTop: 18, fontSize: 7.5, color: "#555555" },
});

export type AnnualPdfInput = { pkg: AnnualPackage; view: TaxView; locale: string | null | undefined; ownerName: string; propertyLabel: string };

export function taxT(locale: string | null | undefined) {
  const lang = locale === "en" ? "en" : "es";
  return { lang, t: createTranslator({ locale: lang === "en" ? "en-US" : "es-US", messages: { tax: lang === "en" ? en : es }, namespace: "tax" }) };
}

export async function renderAnnualPdf({ pkg, view, locale, ownerName, propertyLabel }: AnnualPdfInput): Promise<Buffer> {
  const { lang, t } = taxT(locale);
  const tag = lang === "en" ? "en-US" : "es-US";
  const money = (n: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(n);
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { dateStyle: "medium", timeZone: "UTC" });
  const se = view === "schedule_e";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });

  const Total = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <View style={S.total}>
      {se ? <Text style={S.line} /> : null}
      <Text style={strong ? [S.label, S.bold] : S.label}>{label}</Text>
      <Text style={strong ? [S.amount, S.bold] : S.amount}>{money(value)}</Text>
    </View>
  );

  const doc = (
    <Document title={t("pdf.title", { year: pkg.year })} language={lang} author="ContractOS">
      <Page size="LETTER" style={S.page}>
        <Text style={S.brand}>ContractOS</Text>
        <Text style={S.title}>{t("pdf.title", { year: pkg.year })}</Text>
        <Text style={S.sub}>
          {ownerName} · {propertyLabel} · {se ? t("annual.viewScheduleE") : t("annual.viewAnejo")} · {t("pdf.generated", { date: date(today) })}
        </Text>

        <View style={S.notice}>
          <Text style={S.noticeTitle}>{t("reviewNotice.title")}</Text>
          <Text>{t("reviewNotice.body")}</Text>
        </View>

        <View style={S.row}>
          <Text style={[S.label, S.bold]}>{t("annual.totals.income")}</Text>
          <Text style={[S.amount, S.bold]}>{money(pkg.income)}</Text>
        </View>
        <View style={S.row}>
          <Text style={S.label}>{t("annual.totals.expenses")}</Text>
          <Text style={S.amount}>{money(pkg.expenses)}</Text>
        </View>
        <View style={S.row}>
          <Text style={S.label}>{t("annual.totals.net")}</Text>
          <Text style={S.amount}>{money(pkg.net)}</Text>
        </View>
        <View style={S.row}>
          <Text style={S.label}>{t("annual.totals.depreciation")}</Text>
          <Text style={S.amount}>{money(pkg.depreciation)}</Text>
        </View>
        <View style={S.row}>
          <Text style={[S.label, S.bold]}>{t("annual.totals.netAfter")}</Text>
          <Text style={[S.amount, S.bold]}>{money(pkg.netAfterDepreciation)}</Text>
        </View>

        {pkg.properties.map((p) => {
          const groups = groupLines(p.lines, view);
          return (
            <View key={p.id} wrap={false}>
              <Text style={S.h2}>{p.name}</Text>
              {p.address ? <Text style={S.muted}>{p.address}</Text> : null}
              <Text style={S.muted}>{t(`annual.source.${p.incomeSource}`, { year: pkg.year })}</Text>
              <View style={S.head}>
                {se ? <Text style={[S.line, S.bold]}>{t("annual.table.line")}</Text> : null}
                <Text style={[S.label, S.bold]}>{se ? t("annual.table.concept") : t("annual.table.group")}</Text>
                <Text style={[S.amount, S.bold]}>{t("annual.table.amount")}</Text>
              </View>
              {groups.length === 0 ? (
                <Text style={[S.muted, { paddingVertical: 4 }]}>{t("annual.table.noLines", { year: pkg.year })}</Text>
              ) : (
                groups.map((g) => (
                  <View key={g.key} style={S.row}>
                    {se ? <Text style={S.line}>{g.scheduleE}</Text> : null}
                    <Text style={S.label}>
                      {se
                        ? `${t(`scheduleE.${g.scheduleE}` as "scheduleE.3")}${g.scheduleE === 3 || lang === "en" ? "" : ` (${(SCHEDULE_E_LINES as Record<number, string>)[g.scheduleE] ?? ""})`}`
                        : t(`anejoN.${g.anejoN}`)}
                      {g.estimated ? ` · ${t("annual.estimated")}` : ""}
                    </Text>
                    <Text style={S.amount}>{money(g.amount)}</Text>
                  </View>
                ))
              )}
              <Total label={t("annual.table.totalExpenses")} value={p.expenses} />
              <Total label={t("annual.table.net")} value={p.net} strong />
              {p.depreciation && p.depreciation.annual > 0 ? <Total label={t("annual.table.netAfter")} value={p.netAfterDepreciation} /> : null}
              {p.crimPaid > 0 ? <Text style={S.muted}>{t("annual.crimPaidNote", { year: pkg.year, amount: money(p.crimPaid) })}</Text> : null}
              {p.depreciation ? (
                <Text style={S.muted}>
                  {t("annual.depreciation.title")}: {t("annual.depreciation.purchase")} {money(p.depreciation.purchasePrice)} · {t("annual.depreciation.buildingPct")}{" "}
                  {p.depreciation.buildingPct}% · {t("annual.depreciation.placedInService")} {date(p.depreciation.placedInService)} · {t("annual.depreciation.basis")}{" "}
                  {money(p.depreciation.basis)}
                </Text>
              ) : null}
            </View>
          );
        })}

        <Text style={S.foot}>{t("annual.depreciation.hint")}</Text>
        <Text style={S.foot}>{t("annual.disclaimer.body")}</Text>
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
