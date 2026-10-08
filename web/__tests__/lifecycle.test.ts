import { describe, expect, it, beforeAll } from "vitest";
import { daysSince, nextLifecycleStep } from "@/lib/lifecycle/steps";
import { unsubscribeSignature, verifyUnsubscribe } from "@/lib/lifecycle/unsubscribe";

const none = { properties: 0, contracts: 0, sentForSignature: 0 };

describe("nextLifecycleStep", () => {
  it("welcomes on day 0 and never twice", () => {
    expect(nextLifecycleStep(0, none, new Set())).toBe("welcome");
    expect(nextLifecycleStep(0, none, new Set(["welcome"]))).toBeNull();
  });

  it("skips steps already done", () => {
    expect(nextLifecycleStep(2, none, new Set(["welcome"]))).toBe("first_property");
    expect(nextLifecycleStep(2, { ...none, properties: 1 }, new Set(["welcome"]))).toBeNull();
    expect(nextLifecycleStep(4, { ...none, properties: 1 }, new Set(["welcome"]))).toBe("first_contract");
    expect(nextLifecycleStep(8, { properties: 1, contracts: 1, sentForSignature: 1 }, new Set())).toBeNull();
  });

  it("sends at most one email per run and nothing after day 10", () => {
    expect(nextLifecycleStep(1, none, new Set())).toBe("welcome");
    expect(nextLifecycleStep(7, none, new Set(["welcome", "first_property", "first_contract"]))).toBe("esign");
    expect(nextLifecycleStep(11, none, new Set())).toBeNull();
  });

  it("counts whole days since signup", () => {
    expect(daysSince("2026-10-01T23:00:00Z", new Date("2026-10-03T10:00:00Z"))).toBe(1);
  });
});

describe("unsubscribe links", () => {
  beforeAll(() => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
  });
  const id = "00000000-0000-4000-8000-000000000001";

  it("verifies its own signature only", () => {
    expect(verifyUnsubscribe(id, unsubscribeSignature(id))).toBe(true);
    expect(verifyUnsubscribe(id, "nope")).toBe(false);
    expect(verifyUnsubscribe("00000000-0000-4000-8000-000000000002", unsubscribeSignature(id))).toBe(false);
    expect(verifyUnsubscribe("not-a-uuid", unsubscribeSignature("not-a-uuid"))).toBe(false);
  });
});
