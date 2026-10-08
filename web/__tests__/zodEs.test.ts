import { describe, expect, it } from "vitest";
import { z } from "zod";
import "@/lib/zod-es";
import { TenantCreateSchema } from "@/lib/schemas";

describe("Spanish zod messages", () => {
  it("translates common failures", () => {
    const r = TenantCreateSchema.safeParse({ full_name: "", email: "nope" });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toContain("Este campo es requerido.");
    expect(msgs).toContain("Escribe un correo electrónico válido.");
  });

  it("explains number bounds", () => {
    const r = z.number().int().min(1).max(31).safeParse(40);
    expect(r.success ? "" : r.error.issues[0].message).toBe("Debe ser 31 o menos.");
  });
});
