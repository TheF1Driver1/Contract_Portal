import type { ReceiptExtraction } from "./receipt";

// Scoring for the receipt-extraction eval (Plan 39: ≥90% field accuracy on
// 50 anonymized receipts before launch). Pure, so it is unit-tested.

export type ReceiptExpected = { vendor: string | null; date: string | null; total: number | null; category: string };
export const RECEIPT_FIELDS = ["vendor", "date", "total", "category"] as const;
export type ReceiptField = (typeof RECEIPT_FIELDS)[number];

/** Lowercase, no accents or punctuation, collapsed spaces. */
export function normalizeVendor(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which fields the model got right for one receipt. */
export function scoreReceipt(got: ReceiptExtraction | null, want: ReceiptExpected): Record<ReceiptField, boolean> {
  const vg = normalizeVendor(got?.vendor);
  const vw = normalizeVendor(want.vendor);
  return {
    // Vendor: either name contains the other (receipts print legal vs. trade names).
    vendor: want.vendor === null ? !got?.vendor : vg.length > 0 && (vg.includes(vw) || vw.includes(vg)),
    date: (got?.date ?? null) === want.date,
    total: want.total === null ? got?.total == null : got?.total != null && Math.abs(got.total - want.total) <= 0.01,
    category: got?.category === want.category,
  };
}

export type EvalSummary = {
  receipts: number;
  fieldAccuracy: number;
  byField: Record<ReceiptField, number>;
  failures: { file: string; fields: ReceiptField[] }[];
};

export function summarize(results: { file: string; score: Record<ReceiptField, boolean> }[]): EvalSummary {
  const byField = Object.fromEntries(RECEIPT_FIELDS.map((f) => [f, 0])) as Record<ReceiptField, number>;
  let right = 0;
  const failures: EvalSummary["failures"] = [];
  for (const r of results) {
    const missed = RECEIPT_FIELDS.filter((f) => !r.score[f]);
    for (const f of RECEIPT_FIELDS) if (r.score[f]) byField[f]++;
    right += RECEIPT_FIELDS.length - missed.length;
    if (missed.length) failures.push({ file: r.file, fields: missed });
  }
  const n = results.length || 1;
  for (const f of RECEIPT_FIELDS) byField[f] = byField[f] / n;
  return { receipts: results.length, fieldAccuracy: right / (n * RECEIPT_FIELDS.length), byField, failures };
}

// ── Lease Q&A eval ────────────────────────────────────────────────────────────
// Each case: a question, facts the answer must state, and phrases it must not
// contain (e.g. legal conclusions). Matching is accent- and case-insensitive.

export type LeaseQaCase = { question: string; mustInclude: string[]; mustNotInclude?: string[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function scoreLeaseAnswer(answer: string | null, c: LeaseQaCase): { pass: boolean; missing: string[]; forbidden: string[] } {
  const a = fold(answer ?? "");
  const missing = c.mustInclude.filter((x) => !a.includes(fold(x)));
  const forbidden = (c.mustNotInclude ?? []).filter((x) => a.includes(fold(x)));
  return { pass: !!answer && missing.length === 0 && forbidden.length === 0, missing, forbidden };
}
