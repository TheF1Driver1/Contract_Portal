import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  anthropic: () => ({ beta: { messages: { parse } } }),
}));

import { draftNotice, noticeLocale, oldestUnpaidDue, type NoticeFacts } from "@/lib/ai/notice";
import { AiError } from "@/lib/ai/errors";

const late: NoticeFacts = {
  kind: "late_payment",
  today: "2026-10-08",
  tenant_name: "Ana Rivera",
  landlord_name: "Inversiones Boricua",
  property: "Calle Luna 12 #2",
  monthly_rent: 900,
  amount_overdue: 950,
  oldest_unpaid_due_date: "2026-10-01",
  source: "rent_ledger",
};

describe("draftNotice", () => {
  beforeEach(() => parse.mockReset());

  it("sends only the structured facts, in the tenant's language prompt", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { subject: " Balance pendiente ", body: " Saludos, Ana… " }, model: "m", usage: { input_tokens: 400, output_tokens: 150 } });
    const out = await draftNotice(late, "es");
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.output_config.effort).toBe("low");
    expect(req.system).toMatch(/No amenaces con desahucio/);
    const sent = req.messages[0].content[0].text as string;
    expect(sent).toContain('"amount_overdue": 950');
    expect(sent).toContain('"tenant_name": "Ana Rivera"');
    expect(sent).not.toMatch(/@|email|phone|ssn/i);
    expect(out.draft).toEqual({ subject: "Balance pendiente", body: "Saludos, Ana…" });
  });

  it("uses the English prompt for English-speaking tenants", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { subject: "s", body: "b" }, model: "m", usage: { input_tokens: 1, output_tokens: 1 } });
    await draftNotice({ kind: "renewal_offer", today: "2026-10-08", tenant_name: "Ann", landlord_name: "L", property: "P", lease_end: "2026-12-31", current_rent: 1000, proposed_rent: null, proposed_term_months: 12 }, "en");
    expect(parse.mock.calls[0][0].system).toMatch(/Do not threaten eviction/);
  });

  it("maps refusals and empty bodies to typed errors", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null, model: "m", usage: {} });
    await expect(draftNotice(late, "es")).rejects.toEqual(new AiError("refused"));
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { subject: "s", body: " " }, model: "m", usage: {} });
    await expect(draftNotice(late, "es")).rejects.toEqual(new AiError("empty"));
  });
});

describe("notice helpers", () => {
  it("defaults the tenant language to Spanish", () => {
    expect(noticeLocale("en")).toBe("en");
    expect(noticeLocale("es")).toBe("es");
    expect(noticeLocale(null)).toBe("es");
    expect(noticeLocale("fr")).toBe("es");
  });

  it("finds the oldest unpaid due date, applying payments oldest first", () => {
    const charges = [
      { due_date: "2026-08-01", amount: 900 },
      { due_date: "2026-09-01", amount: 900 },
      { due_date: "2026-09-10", amount: 50, voided: true },
      { due_date: "2026-10-01", amount: 900 },
      { due_date: "2026-11-01", amount: 900 },
    ];
    expect(oldestUnpaidDue(charges, 900, "2026-10-08")).toBe("2026-09-01");
    expect(oldestUnpaidDue(charges, 0, "2026-10-08")).toBe("2026-08-01");
    expect(oldestUnpaidDue(charges, 2700, "2026-10-08")).toBeNull();
  });
});
