import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  anthropic: () => ({ beta: { messages: { create } } }),
}));

import { askLease, LeaseHelpError, leaseHelpEnabled } from "@/lib/ai/lease-help";

afterEach(() => vi.unstubAllEnvs());

describe("leaseHelpEnabled", () => {
  it("needs both the API key and the AI_LEASE_HELP flag", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubEnv("AI_LEASE_HELP", "");
    expect(leaseHelpEnabled()).toBe(false);
    vi.stubEnv("AI_LEASE_HELP", "1");
    expect(leaseHelpEnabled()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(leaseHelpEnabled()).toBe(false);
  });
});

describe("askLease", () => {
  beforeEach(() => create.mockReset());
  const ok = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text }], model: "m", usage: { input_tokens: 3000, output_tokens: 120 } });

  it("caches the lease PDF and asks for a summary when there is no question", async () => {
    create.mockResolvedValue(ok("- La renta es $900 al mes."));
    const out = await askLease({ pdf: Buffer.from("%PDF"), lang: "es", question: null });
    const req = create.mock.calls[0][0];
    const [doc, text] = req.messages[0].content;
    expect(doc).toMatchObject({ type: "document", cache_control: { type: "ephemeral" } });
    expect(text.text).toMatch(/^Resume este contrato/);
    expect(req.system).toMatch(/no inventes leyes/);
    expect(req.fallbacks).toBe("default");
    expect(out.answer).toBe("- La renta es $900 al mes.");
  });

  it("uses the English prompt and the tenant's question", async () => {
    create.mockResolvedValue(ok("The lease doesn't mention pets."));
    await askLease({ pdf: Buffer.from("%PDF"), lang: "en", question: "  Can I have pets? " });
    const req = create.mock.calls[0][0];
    expect(req.messages[0].content[1].text).toBe("Can I have pets?");
    expect(req.system).toMatch(/Do not give legal advice/);
  });

  it("throws on refusal or an empty answer", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [], model: "m", usage: {} });
    await expect(askLease({ pdf: Buffer.from("x"), lang: "es", question: "x" })).rejects.toEqual(new LeaseHelpError("refused"));
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "  " }], model: "m", usage: {} });
    await expect(askLease({ pdf: Buffer.from("x"), lang: "es", question: "x" })).rejects.toEqual(new LeaseHelpError("empty"));
  });
});
