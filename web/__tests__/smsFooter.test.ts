import { describe, expect, it } from "vitest";
import { withSmsFooter } from "@/lib/notify";

describe("withSmsFooter", () => {
  it("appends opt-out instructions", () => {
    expect(withSmsFooter("Hola")).toMatch(/STOP/);
  });
  it("does not duplicate an existing STOP line", () => {
    expect(withSmsFooter("Reply STOP to opt out")).toBe("Reply STOP to opt out");
  });
});
