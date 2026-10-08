import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  anthropic: () => ({ beta: { messages: { parse } } }),
}));

import { translateClause, TRANSLATE_SYSTEM } from "@/lib/ai/translate";
import { GLOSSARY, glossaryPrompt } from "@/lib/ai/glossary";
import { AiError } from "@/lib/ai/errors";

const ok = (out: unknown) => ({ stop_reason: "end_turn", parsed_output: out, model: "claude-opus-5-5", usage: { input_tokens: 1500, output_tokens: 200 } });

describe("glossary", () => {
  it("has about 25 Puerto Rico lease terms and is not yet reviewed", () => {
    expect(GLOSSARY.reviewed).toBe(false);
    expect(GLOSSARY.terms.length).toBeGreaterThanOrEqual(25);
    const es = GLOSSARY.terms.map((t) => t.es);
    for (const term of ["arrendador", "arrendatario", "fianza", "canon de arrendamiento", "desahucio", "Código Civil de Puerto Rico de 2020"]) {
      expect(es).toContain(term);
    }
    expect(new Set(es).size).toBe(es.length);
  });

  it("is embedded in the system prompt", () => {
    expect(glossaryPrompt()).toMatch(/^- arrendador = landlord/);
    expect(TRANSLATE_SYSTEM).toContain(glossaryPrompt());
    expect(TRANSLATE_SYSTEM).toContain("fianza = security deposit");
  });
});

describe("translateClause", () => {
  beforeEach(() => parse.mockReset());

  it("sends a cached system block with the glossary, low effort, fallbacks and a structured format", async () => {
    parse.mockResolvedValue(ok({ title: " Pets ", translation: " No pets allowed. ", notes: ["  ", "Check with an attorney."] }));
    const out = await translateClause({ title: "Mascotas", body: "No se permiten mascotas.", target: "en", uiLocale: "es" });
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config.effort).toBe("low");
    expect(req.output_config.format).toBeTruthy();
    expect(req.system).toHaveLength(1);
    expect(req.system[0]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    expect(req.system[0].text).toContain("desahucio = eviction");
    const text = req.messages[0].content[0].text;
    expect(text).toMatch(/from Spanish to English/);
    expect(text).toMatch(/notes in Spanish/);
    expect(text).toContain("<body>\nNo se permiten mascotas.\n</body>");
    expect(out.draft).toEqual({ title: "Pets", translation: "No pets allowed.", notes: ["Check with an attorney."] });
    expect(out.usage).toEqual({ model: "claude-opus-5-5", input_tokens: 1500, output_tokens: 200 });
  });

  it("translates English to Spanish when asked", async () => {
    parse.mockResolvedValue(ok({ title: "Mascotas", translation: "", notes: [] }));
    await translateClause({ title: "Pets", body: "", target: "es", uiLocale: "en" });
    expect(parse.mock.calls[0][0].messages[0].content[0].text).toMatch(/from English to Spanish\. Write the notes in English/);
  });

  it("keeps the system prompt identical across directions so it caches", async () => {
    parse.mockResolvedValue(ok({ title: "x", translation: "y", notes: [] }));
    await translateClause({ title: "a", body: "b", target: "en", uiLocale: "es" });
    await translateClause({ title: "a", body: "b", target: "es", uiLocale: "en" });
    expect(parse.mock.calls[0][0].system).toEqual(parse.mock.calls[1][0].system);
  });

  it("maps refusals and empty output to typed errors", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null, model: "m", usage: {} });
    await expect(translateClause({ title: "a", body: "", target: "en", uiLocale: "es" })).rejects.toEqual(new AiError("refused"));
    parse.mockResolvedValue(ok({ title: "  ", translation: "", notes: [] }));
    await expect(translateClause({ title: "a", body: "", target: "en", uiLocale: "es" })).rejects.toEqual(new AiError("empty"));
  });
});
