import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactSchema } from "@/lib/schemas";

async function stripeLib(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/stripe");
}

afterEach(() => vi.unstubAllEnvs());

describe("priceFor", () => {
  it("uses the yearly price when configured and falls back to monthly", async () => {
    const s = await stripeLib({
      STRIPE_PRICE_PROPIETARIO: "price_m1",
      STRIPE_PRICE_INVERSIONISTA: "price_m2",
      STRIPE_PRICE_PROPIETARIO_YEARLY: "price_y1",
      STRIPE_PRICE_INVERSIONISTA_YEARLY: "",
    });
    expect(s.priceFor("propietario", "year")).toBe("price_y1");
    expect(s.priceFor("propietario", "month")).toBe("price_m1");
    expect(s.priceFor("inversionista", "year")).toBe("price_m2");
    expect(s.priceFor("free", "month")).toBeUndefined();
    expect(s.billingOptions().yearly).toBe(true);
    expect(s.planForPrice("price_y1")).toBe("propietario");
  });

  it("reports no yearly option without yearly prices", async () => {
    const s = await stripeLib({ STRIPE_PRICE_PROPIETARIO_YEARLY: "", STRIPE_PRICE_INVERSIONISTA_YEARLY: "" });
    expect(s.billingOptions().yearly).toBe(false);
  });
});

describe("trialDays", () => {
  it.each([
    ["", 0],
    ["14", 14],
    ["0", 0],
    ["-3", 0],
    ["90", 0],
    ["abc", 0],
  ])("STRIPE_TRIAL_DAYS=%j → %i", async (v, want) => {
    const s = await stripeLib({ STRIPE_TRIAL_DAYS: v });
    expect(s.trialDays()).toBe(want);
  });
});

describe("ContactSchema", () => {
  const base = { name: "Ana Rivera", email: "ana@example.com", message: "Manejo 40 unidades en Ponce." };
  it("accepts a normal inquiry and coerces units", () => {
    const r = ContactSchema.parse({ ...base, units: "40" });
    expect(r.units).toBe(40);
    expect(r.locale).toBe("es");
  });
  it("rejects a filled honeypot, bad email and short message", () => {
    expect(ContactSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
    expect(ContactSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(ContactSchema.safeParse({ ...base, message: "hola" }).success).toBe(false);
  });
});
