/** Move-in / move-out inspection report (Plan 36), in the reader's language. */
import React from "react";
import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import es from "@/messages/es/inspections.json";
import en from "@/messages/en/inspections.json";
import type { InspectionCondition, InspectionKind } from "@/lib/db";
import { groupByRoom, inspectionLabeler, worsened } from "@/lib/inspections/checklist";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.45, color: "#111111", padding: 48 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#0f766e", marginBottom: 14 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 2 },
  draft: { fontFamily: "Helvetica-Bold", fontSize: 20, color: "#b45309", marginBottom: 6 },
  meta: { flexDirection: "row", marginBottom: 1 },
  metaLabel: { width: 130, color: "#555555" },
  metaValue: { flex: 1 },
  room: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 14, marginBottom: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999999", paddingBottom: 2, color: "#555555" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 3 },
  cItem: { width: 130 },
  cCond: { width: 70 },
  cBase: { width: 70, color: "#555555" },
  cNote: { flex: 1 },
  worse: { color: "#b91c1c", fontFamily: "Helvetica-Bold" },
  photos: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  photo: { width: 72, height: 72, objectFit: "cover", marginRight: 4, marginBottom: 4 },
  notes: { marginTop: 10 },
  note: { marginTop: 18, fontSize: 8, color: "#555555" },
});

export type InspectionPdfItem = {
  room: string;
  item: string;
  condition: InspectionCondition | null;
  note: string | null;
  sort: number;
  baseline: InspectionCondition | null | undefined;
  photoCount: number;
  /** JPEG/PNG thumbnails that could be embedded. */
  images: { data: Buffer; format: "jpg" | "png" }[];
};

export type InspectionPdfData = {
  kind: InspectionKind;
  draft: boolean;
  inspectedOn: string;
  property: string;
  tenant: string;
  landlord: string;
  notes: string | null;
  completedAt: string | null;
  ackAt: string | null;
  ackName: string | null;
  items: InspectionPdfItem[];
  locale: string | null | undefined;
};

export async function renderInspectionPdf(d: InspectionPdfData): Promise<Buffer> {
  const lang = d.locale === "en" ? "en" : "es";
  const tag = lang === "en" ? "en-US" : "es-US";
  const t = createTranslator({ locale: tag, messages: { inspections: lang === "en" ? en : es }, namespace: "inspections" });
  const tk = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const labels = inspectionLabeler(d.items.map((i) => i.room), tk, (k) => t.has(k as "section"));
  const date = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString(tag, { dateStyle: "long", timeZone: s.length === 10 ? "UTC" : "America/Puerto_Rico" });
  const cond = (c: InspectionCondition | null | undefined) => (c ? tk(`condition.${c}`) : "—");
  const moveOut = d.kind === "move_out";

  const Meta = ({ label, value }: { label: string; value: string }) => (
    <View style={S.meta}>
      <Text style={S.metaLabel}>{label}</Text>
      <Text style={S.metaValue}>{value}</Text>
    </View>
  );

  const doc = (
    <Document title={tk(`kind.${d.kind}`)} language={lang} author="ContractOS">
      <Page size="LETTER" style={S.page}>
        <Text style={S.brand}>ContractOS</Text>
        {d.draft ? <Text style={S.draft}>{t("pdf.draft")}</Text> : null}
        <Text style={S.title}>{tk(`kind.${d.kind}`)}</Text>
        <View style={{ marginTop: 8 }}>
          <Meta label={t("pdf.property")} value={d.property} />
          <Meta label={t("pdf.tenant")} value={d.tenant} />
          <Meta label={t("pdf.landlord")} value={d.landlord} />
          <Meta label={t("pdf.date")} value={date(d.inspectedOn)} />
          <Meta label={t("pdf.completed")} value={d.completedAt ? date(d.completedAt) : "—"} />
          <Meta label={t("pdf.ack")} value={d.ackAt ? `${d.ackName ?? ""} · ${date(d.ackAt)}` : t("pdf.notAck")} />
        </View>
        {d.notes ? (
          <View style={S.notes}>
            <Text>{d.notes}</Text>
          </View>
        ) : null}

        {groupByRoom(d.items).map((g) => (
          <View key={g.room} wrap>
            <Text style={S.room}>{labels.room(g.room)}</Text>
            <View style={S.head}>
              <Text style={S.cItem}>{t("pdf.item")}</Text>
              <Text style={S.cCond}>{t("pdf.condition")}</Text>
              {moveOut ? <Text style={S.cBase}>{t("pdf.moveIn")}</Text> : null}
              <Text style={S.cNote}>{t("pdf.note")}</Text>
            </View>
            {g.items.map((i) => (
              <View key={`${i.room}/${i.item}`} style={S.row} wrap={false}>
                <Text style={S.cItem}>{labels.item(i.item)}</Text>
                <Text style={worsened(i.baseline, i.condition) ? [S.cCond, S.worse] : S.cCond}>{cond(i.condition)}</Text>
                {moveOut ? <Text style={S.cBase}>{cond(i.baseline)}</Text> : null}
                <View style={S.cNote}>
                  <Text>
                    {[i.note, i.photoCount > i.images.length ? t("pdf.photoCount", { count: i.photoCount }) : null].filter(Boolean).join(" · ")}
                  </Text>
                  {i.images.length > 0 ? (
                    <View style={S.photos}>
                      {i.images.map((img, n) => (
                        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
                        <Image key={n} style={S.photo} src={img} />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={S.note}>{t("pdf.disclaimer")}</Text>
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
