import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fakeSupabase";

const create = vi.fn();
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  anthropic: () => ({ beta: { messages: { create } } }),
}));

import { askData, MAX_TOOL_ITERATIONS } from "@/lib/ai/ask-data";
import { dataToolDefinitions, runDataTool, type ToolContext } from "@/lib/ai/data-tools";
import { AiError, aiErrorCode } from "@/lib/ai/errors";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const TODAY = "2026-10-08";

function data() {
  const lease = (id: string, owner: string, tenant: string, extra: Record<string, unknown> = {}) => ({
    id,
    owner_id: owner,
    status: "signed",
    rent_amount: 900,
    lease_end: "2027-06-30",
    tenant: { full_name: tenant, email: `${tenant}@x.test`, phone: "787" },
    property: { name: `Casa ${tenant}` },
    ...extra,
  });
  return fakeSupabase({
    contracts: [
      lease("c1", ME, "Ana"),
      lease("c2", ME, "Beto", { lease_end: "2026-11-15" }),
      lease("c3", ME, "Carla", { status: "draft", lease_end: "2026-10-20" }),
      lease("c4", OTHER, "Otro", { lease_end: "2026-10-30" }),
      lease("c5", ME, "Dora", { lease_end: "2026-10-20" }),
    ],
    rent_ledgers: [
      { contract_id: "c1", owner_id: ME },
      { contract_id: "c2", owner_id: ME },
      { contract_id: "c4", owner_id: OTHER },
    ],
    rent_charges: [
      { contract_id: "c1", owner_id: ME, kind: "rent", period: "2026-09-01", due_date: "2026-09-01", amount: 900, voided_at: null },
      { contract_id: "c1", owner_id: ME, kind: "rent", period: "2026-10-01", due_date: "2026-10-01", amount: 900, voided_at: null },
      { contract_id: "c1", owner_id: ME, kind: "late_fee", period: "2026-10-01", due_date: "2026-10-06", amount: 50, voided_at: null },
      { contract_id: "c2", owner_id: ME, kind: "rent", period: "2026-10-01", due_date: "2026-10-01", amount: 900, voided_at: null },
      { contract_id: "c4", owner_id: OTHER, kind: "rent", period: "2026-10-01", due_date: "2026-10-01", amount: 5000, voided_at: null },
    ],
    payments: [
      { contract_id: "c1", owner_id: ME, amount: 900, received_on: "2026-09-03", voided_at: null },
      { contract_id: "c2", owner_id: ME, amount: 900, received_on: "2026-10-02", voided_at: null },
      { contract_id: "c2", owner_id: ME, amount: 100, received_on: "2026-10-03", voided_at: "2026-10-04" },
      { contract_id: "c4", owner_id: OTHER, amount: 5000, received_on: "2026-10-02", voided_at: null },
    ],
    maintenance_requests: [
      { owner_id: ME, title: "Gotera", category: "plumbing", urgency: "normal", status: "open", created_at: "2026-10-01T10:00:00Z", scheduled_for: null, property: { name: "Casa Ana" } },
      { owner_id: ME, title: "Sin luz", category: "electrical", urgency: "emergency", status: "in_progress", created_at: "2026-10-05T10:00:00Z", scheduled_for: "2026-10-09", property: { name: "Casa Beto" } },
      { owner_id: ME, title: "Pintura", category: "other", urgency: "low", status: "resolved", created_at: "2026-09-01T10:00:00Z", scheduled_for: null, property: null },
      { owner_id: OTHER, title: "Ajeno", category: "other", urgency: "urgent", status: "open", created_at: "2026-10-01T10:00:00Z", scheduled_for: null, property: null },
    ],
  });
}

const ctx = (): ToolContext => ({ supabase: data().client as unknown as ToolContext["supabase"], userId: ME, today: TODAY });

describe("data tools (read-only, owner-scoped)", () => {
  it("lists overdue leases from the rent ledger only", async () => {
    const out = (await runDataTool(ctx(), "list_overdue_leases", {})) as { overdue: unknown[]; leases_without_rent_tracking: number };
    expect(out.overdue).toEqual([{ tenant: "Ana", property: "Casa Ana", amount_overdue: 950, balance: 950 }]);
    // c5 (Dora) is signed without a ledger; c3 is a draft; c4 belongs to someone else.
    expect(out.leases_without_rent_tracking).toBe(1);
    expect(JSON.stringify(out)).not.toMatch(/@x\.test|787/);
  });

  it("lists leases expiring within the window, soonest first", async () => {
    const out = (await runDataTool(ctx(), "list_expiring_leases", { days: 60 })) as { leases: { tenant: string; lease_end: string }[] };
    expect(out.leases.map((l) => l.tenant)).toEqual(["Dora", "Beto"]);
    const def = (await runDataTool(ctx(), "list_expiring_leases", {})) as { within_days: number };
    expect(def.within_days).toBe(60);
  });

  it("sums rent collected and charged in a month, ignoring voided payments", async () => {
    const out = await runDataTool(ctx(), "rent_collected", { month: "2026-10" });
    expect(out).toMatchObject({ month: "2026-10", collected: 900, payments_count: 1, charged: 1850 });
  });

  it("lists open maintenance, most urgent first", async () => {
    const out = (await runDataTool(ctx(), "open_maintenance_requests", {})) as { requests: { title: string }[] };
    expect(out.requests.map((r) => r.title)).toEqual(["Sin luz", "Gotera"]);
  });

  it("rejects unknown tools and bad input", async () => {
    await expect(runDataTool(ctx(), "delete_everything", {})).rejects.toThrow(/unknown tool/);
    await expect(runDataTool(ctx(), "rent_collected", { month: "octubre" })).rejects.toThrow(/invalid input/);
    await expect(runDataTool(ctx(), "list_expiring_leases", { days: 9999 })).rejects.toThrow(/invalid input/);
  });

  it("describes every tool as an object schema without $schema", () => {
    const defs = dataToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(["list_overdue_leases", "list_expiring_leases", "rent_collected", "open_maintenance_requests"]);
    for (const d of defs) {
      expect(d.input_schema.type).toBe("object");
      expect(d.input_schema).not.toHaveProperty("$schema");
      expect(d.description.length).toBeGreaterThan(20);
    }
    const month = defs.find((d) => d.name === "rent_collected")!.input_schema as { properties: Record<string, unknown>; required: string[] };
    expect(month.required).toEqual(["month"]);
  });
});

describe("askData tool loop", () => {
  beforeEach(() => create.mockReset());
  const usage = { input_tokens: 100, output_tokens: 20 };

  it("runs the requested tools, sends results back and returns text plus tools used", async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        model: "claude-opus-5-5",
        usage,
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "tool_use", id: "tu1", name: "list_overdue_leases", input: {} },
        ],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", model: "claude-opus-5-5", usage, content: [{ type: "text", text: "- Ana debe $950." }] });
    const runTool = vi.fn(async () => ({ overdue: [{ tenant: "Ana", amount_overdue: 950 }] }));
    const out = await askData({ question: " ¿Quién está atrasado? ", locale: "es", today: TODAY, runTool });

    expect(out).toEqual({ answer: "- Ana debe $950.", tools: ["list_overdue_leases"], usage: { model: "claude-opus-5-5", input_tokens: 200, output_tokens: 40 } });
    expect(runTool).toHaveBeenCalledWith("list_overdue_leases", {});
    const first = create.mock.calls[0][0];
    expect(first.tool_choice).toEqual({ type: "auto" });
    expect(first.fallbacks).toBe("default");
    expect(first.output_config.effort).toBe("low");
    expect(first.tools).toHaveLength(4);
    expect(first.system).toContain(TODAY);
    const second = create.mock.calls[1][0];
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1].content[0].type).toBe("thinking");
    expect(second.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu1" });
    expect(JSON.parse(second.messages[2].content[0].content)).toEqual({ overdue: [{ tenant: "Ana", amount_overdue: 950 }] });
  });

  it("reports failed lookups to the model without details", async () => {
    create
      .mockResolvedValueOnce({ stop_reason: "tool_use", model: "m", usage, content: [{ type: "tool_use", id: "tu1", name: "rent_collected", input: { month: "x" } }] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", model: "m", usage, content: [{ type: "text", text: "No pude buscarlo." }] });
    const out = await askData({ question: "¿Cuánto cobré?", locale: "es", today: TODAY, runTool: async () => { throw new Error("invalid input: secret"); } });
    const result = create.mock.calls[1][0].messages[2].content[0];
    expect(result).toMatchObject({ is_error: true, content: "The lookup failed." });
    expect(out.tools).toEqual([]);
  });

  it("stops after the iteration cap and keeps the usage for metering", async () => {
    create.mockResolvedValue({ stop_reason: "tool_use", model: "m", usage, content: [{ type: "tool_use", id: "t", name: "list_expiring_leases", input: {} }] });
    const err = await askData({ question: "loop", locale: "en", today: TODAY, runTool: async () => ({}) }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("too_many_steps");
    expect(err.usage.input_tokens).toBe(100 * MAX_TOOL_ITERATIONS);
    expect(create).toHaveBeenCalledTimes(MAX_TOOL_ITERATIONS);
  });

  it("maps refusals and empty answers", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", model: "m", usage, content: [] });
    await expect(askData({ question: "x?", locale: "es", today: TODAY, runTool: async () => ({}) })).rejects.toEqual(new AiError("refused"));
    create.mockResolvedValue({ stop_reason: "end_turn", model: "m", usage, content: [{ type: "text", text: " " }] });
    await expect(askData({ question: "x?", locale: "es", today: TODAY, runTool: async () => ({}) })).rejects.toEqual(new AiError("empty"));
  });
});

describe("aiErrorCode", () => {
  it("maps SDK and feature errors to codes and logs status only", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(aiErrorCode(new AiError("refused"), "qa")).toBe("refused");
    expect(aiErrorCode(new Anthropic.RateLimitError(429, {}, "slow down", new Headers()), "qa")).toBe("busy");
    expect(aiErrorCode(new Anthropic.APIError(529, {}, "overloaded", new Headers()), "qa")).toBe("busy");
    expect(aiErrorCode(new Anthropic.InternalServerError(500, {}, "secret prompt text", new Headers()), "translate")).toBe("failed");
    expect(aiErrorCode(new Error("boom"), "notice")).toBe("failed");
    const logged = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"status":500');
    expect(logged).not.toContain("secret prompt text");
    expect(logged).not.toContain("boom");
    log.mockRestore();
  });
});
