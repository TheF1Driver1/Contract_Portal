import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  anthropic: () => ({ beta: { messages: { parse } } }),
}));

import { extractReceipt, normalizeReceipt, ReceiptError, type ReceiptExtraction } from "@/lib/ai/receipt";

const base: ReceiptExtraction = {
  is_receipt: true,
  vendor: "  Ferretería Ochoa ",
  date: "2026-09-14",
  total: 123.456,
  currency: "usd",
  category: "repairs",
  description: "Válvula y tubería PVC para baño",
};

describe("normalizeReceipt", () => {
  it("rounds money, trims text and uppercases currency", () => {
    const r = normalizeReceipt(base);
    expect(r.total).toBe(123.46);
    expect(r.vendor).toBe("Ferretería Ochoa");
    expect(r.currency).toBe("USD");
  });
  it("drops impossible dates and amounts", () => {
    expect(normalizeReceipt({ ...base, date: "14/09/2026" }).date).toBeNull();
    expect(normalizeReceipt({ ...base, date: "2026-13-45" }).date).toBeNull();
    expect(normalizeReceipt({ ...base, total: -5 }).total).toBeNull();
    expect(normalizeReceipt({ ...base, total: Number.NaN }).total).toBeNull();
    expect(normalizeReceipt({ ...base, vendor: "   " }).vendor).toBeNull();
  });
});

describe("extractReceipt", () => {
  beforeEach(() => parse.mockReset());

  it("sends a PDF as a document block with fallbacks and low effort", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: base, model: "claude-opus-5-5", usage: { input_tokens: 900, output_tokens: 80 } });
    const out = await extractReceipt({ bytes: Buffer.from("%PDF-1.4"), mediaType: "application/pdf" });
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config.effort).toBe("low");
    expect(req.messages[0].content[0].type).toBe("document");
    expect(out.draft.total).toBe(123.46);
    expect(out.usage.input_tokens).toBe(900);
  });

  it("sends photos as image blocks", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: base, model: "m", usage: { input_tokens: 1, output_tokens: 1 } });
    await extractReceipt({ bytes: Buffer.from([1, 2, 3]), mediaType: "image/jpeg" });
    const block = parse.mock.calls[0][0].messages[0].content[0];
    expect(block).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg" } });
  });

  it("maps refusals and empty output to typed errors", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null, model: "m", usage: {} });
    await expect(extractReceipt({ bytes: Buffer.from("x"), mediaType: "image/png" })).rejects.toEqual(new ReceiptError("refused"));
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null, model: "m", usage: {} });
    await expect(extractReceipt({ bytes: Buffer.from("x"), mediaType: "image/png" })).rejects.toEqual(new ReceiptError("unreadable"));
  });
});
