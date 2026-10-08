import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/safe-redirect";

describe("safeRedirect", () => {
  it("allows same-site paths", () => {
    expect(safeRedirect("/invite/manager/abc")).toBe("/invite/manager/abc");
  });
  it("rejects external and protocol-relative targets", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/a\nb", ""]) {
      expect(safeRedirect(bad)).toBe("/dashboard");
    }
  });
});
