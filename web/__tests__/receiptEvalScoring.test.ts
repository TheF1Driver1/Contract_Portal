import { describe, expect, it } from "vitest";
import { normalizeVendor, scoreReceipt, summarize } from "@/lib/ai/eval";

const got = { is_receipt: true, vendor: "FERRETERÍA OCHOA, INC.", date: "2026-09-14", total: 123.45, currency: "USD", category: "repairs" as const, description: null };

describe("receipt eval scoring", () => {
  it("normalizes vendor names", () => {
    expect(normalizeVendor("  Ferretería  Ochoa, Inc. ")).toBe("ferreteria ochoa inc");
  });

  it("scores each field", () => {
    expect(scoreReceipt(got, { vendor: "Ferreteria Ochoa", date: "2026-09-14", total: 123.45, category: "repairs" })).toEqual({ vendor: true, date: true, total: true, category: true });
    expect(scoreReceipt(got, { vendor: "Home Depot", date: "2026-09-15", total: 123.47, category: "maintenance" })).toEqual({ vendor: false, date: false, total: false, category: false });
    expect(scoreReceipt(null, { vendor: null, date: null, total: null, category: "other" }).vendor).toBe(true);
  });

  it("summarizes field accuracy and lists failures", () => {
    const s = summarize([
      { file: "a.jpg", score: { vendor: true, date: true, total: true, category: true } },
      { file: "b.pdf", score: { vendor: true, date: false, total: true, category: false } },
    ]);
    expect(s.fieldAccuracy).toBe(0.75);
    expect(s.byField.date).toBe(0.5);
    expect(s.failures).toEqual([{ file: "b.pdf", fields: ["date", "category"] }]);
  });
});
