import { describe, expect, it } from "vitest";
import { hasFeature, minimumPlanFor } from "@/lib/entitlements";
import { planLimitMessage } from "@/lib/plan-errors";
import { templatePath } from "@/lib/template-storage";

describe("entitlements", () => {
  it("gates paid features off the free plan", () => {
    expect(hasFeature("free", "sms")).toBe(false);
    expect(hasFeature("free", "market")).toBe(false);
    expect(hasFeature("propietario", "sms")).toBe(true);
    expect(hasFeature("propietario", "schedule_e")).toBe(false);
    expect(hasFeature("inversionista", "schedule_e")).toBe(true);
  });

  it("names the cheapest plan that unlocks a feature", () => {
    expect(minimumPlanFor("market")).toBe("propietario");
    expect(minimumPlanFor("schedule_e")).toBe("inversionista");
  });
});

describe("planLimitMessage", () => {
  it("maps database trigger errors to Spanish upgrade messages", () => {
    expect(planLimitMessage({ message: "plan_limit_properties" })).toMatch(/propiedades/);
    expect(planLimitMessage("ERROR: plan_limit_contracts")).toMatch(/contratos/);
  });

  it("ignores unrelated errors", () => {
    expect(planLimitMessage({ message: "duplicate key value" })).toBeNull();
    expect(planLimitMessage(null)).toBeNull();
  });
});

describe("templatePath", () => {
  it("extracts the storage path from a legacy public URL", () => {
    expect(
      templatePath("https://x.supabase.co/storage/v1/object/public/contract-templates/u1/t1.docx")
    ).toBe("u1/t1.docx");
  });

  it("passes plain storage paths through", () => {
    expect(templatePath("u1/t1.docx")).toBe("u1/t1.docx");
  });
});
