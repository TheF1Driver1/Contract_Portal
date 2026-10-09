// @vitest-environment node
// Tenant lease Q&A eval against the real model. Skipped unless configured:
//   LEASE_EVAL_DIR=/path ANTHROPIC_API_KEY=... npm run eval:lease
// The folder holds lease.pdf and cases.json:
//   [{ "question": "¿Puedo tener mascotas?", "lang": "es", "mustInclude": ["no se permiten"], "mustNotInclude": ["es ilegal"] }]
// Use question: null for the plain-language summary. Writes results-<timestamp>.json
// and fails below a 90% pass rate. Have the attorney review the answers it prints.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { askLease } from "@/lib/ai/lease-help";
import { scoreLeaseAnswer, type LeaseQaCase } from "@/lib/ai/eval";

const DIR = process.env.LEASE_EVAL_DIR;

describe.skipIf(!DIR)("lease Q&A eval", () => {
  it("passes 90% of the cases", { timeout: 30 * 60_000 }, async () => {
    const pdf = fs.readFileSync(path.join(DIR!, "lease.pdf"));
    const cases = JSON.parse(fs.readFileSync(path.join(DIR!, "cases.json"), "utf8")) as (LeaseQaCase & { lang?: "es" | "en"; question: string | null })[];
    const results = [];
    for (const c of cases) {
      let answer: string | null = null;
      try {
        ({ answer } = await askLease({ pdf, lang: c.lang ?? "es", question: c.question }));
      } catch (e) {
        console.error(c.question, (e as Error).message);
      }
      results.push({ ...c, answer, ...scoreLeaseAnswer(answer, c) });
    }
    const passRate = results.filter((r) => r.pass).length / (results.length || 1);
    fs.writeFileSync(path.join(DIR!, `results-${Date.now()}.json`), JSON.stringify({ passRate, results }, null, 2));
    console.log(JSON.stringify({ passRate, failed: results.filter((r) => !r.pass).map((r) => ({ q: r.question, missing: r.missing, forbidden: r.forbidden })) }, null, 2));
    expect(passRate).toBeGreaterThanOrEqual(0.9);
  });
});
