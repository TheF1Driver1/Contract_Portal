import { describe, expect, it } from "vitest";
import { effectivePlan, storedStatus } from "@/lib/stripe";

describe("effectivePlan", () => {
  it("keeps the paid plan while active, trialing or retrying", () => {
    expect(effectivePlan("active", "propietario")).toBe("propietario");
    expect(effectivePlan("trialing", "inversionista")).toBe("inversionista");
    expect(effectivePlan("past_due", "propietario")).toBe("propietario");
  });

  it("drops to free once Stripe gives up or the customer cancels", () => {
    expect(effectivePlan("unpaid", "propietario")).toBe("free");
    expect(effectivePlan("canceled", "inversionista")).toBe("free");
    expect(effectivePlan("incomplete_expired", "propietario")).toBe("free");
  });
});

describe("storedStatus", () => {
  it("maps Stripe statuses onto the table's allowed values", () => {
    expect(storedStatus("unpaid")).toBe("past_due");
    expect(storedStatus("incomplete")).toBe("canceled");
    expect(storedStatus("trialing")).toBe("trialing");
  });
});
