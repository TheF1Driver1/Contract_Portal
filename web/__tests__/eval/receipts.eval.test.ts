// @vitest-environment node
// Receipt-extraction eval against the real model. Skipped unless configured:
//   RECEIPT_EVAL_DIR=/path/to/receipts ANTHROPIC_API_KEY=... npm run eval:receipts
// The folder holds the anonymized receipt files (jpg/png/webp/pdf) and an
// expected.json: { "<file>": { "vendor": "...", "date": "YYYY-MM-DD", "total": 12.34, "category": "repairs" } }.
// Writes results-<timestamp>.json next to them and fails below 90% field accuracy.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractReceipt, type ReceiptMediaType } from "@/lib/ai/receipt";
import { scoreReceipt, summarize, type ReceiptExpected } from "@/lib/ai/eval";

const DIR = process.env.RECEIPT_EVAL_DIR;
const TYPES: Record<string, ReceiptMediaType> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf" };

describe.skipIf(!DIR)("receipt extraction eval", () => {
  it("reaches 90% field accuracy", { timeout: 30 * 60_000 }, async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(DIR!, "expected.json"), "utf8")) as Record<string, ReceiptExpected>;
    const results = [];
    for (const [file, want] of Object.entries(expected)) {
      const mediaType = TYPES[path.extname(file).toLowerCase()];
      if (!mediaType) throw new Error(`unsupported file type: ${file}`);
      let got = null;
      try {
        ({ draft: got } = await extractReceipt({ bytes: fs.readFileSync(path.join(DIR!, file)), mediaType }));
      } catch (e) {
        console.error(file, (e as Error).message);
      }
      results.push({ file, got, want, score: scoreReceipt(got, want) });
    }
    const summary = summarize(results);
    fs.writeFileSync(path.join(DIR!, `results-${Date.now()}.json`), JSON.stringify({ summary, results }, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    expect(summary.fieldAccuracy).toBeGreaterThanOrEqual(0.9);
  });
});
