// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderContractPdf, fechaLarga, dinero } from "@/lib/pdf-react";
import type { Contract } from "@/lib/types";

const contract = {
  id: "30000000-0000-4000-8000-000000000001",
  owner_id: "u1",
  property_id: "p1",
  tenant_id: "t1",
  contract_type: "lease",
  status: "draft",
  lease_start: "2026-11-01",
  lease_end: "2027-10-31",
  lease_months: 12,
  rent_amount: 1150,
  rent_amount_verbal: "mil ciento cincuenta dólares",
  security_deposit: 1150,
  payment_due_day: 1,
  late_fee_day: 6,
  late_fee_type: "fixed",
  late_fee_grace_period_days: 5,
  late_fee_fixed_amount: 50,
  late_fee_daily_amount: 0,
  occupant_names: ["Ana Colón"],
  occupant_count: 2,
  key_count: 2,
  amenities: { fridge: true, stove_count: 1, ac: true },
  governing_law: "codigo_civil_pr_2020",
  tenant_snapshot: { full_name: "José Martínez", license_number: "123456" },
  property_snapshot: { name: "Edificio Las Palmas 2B", address: "Calle Loíza 1850", city: "San Juan", state: "PR", zip: "00911", parking_available: true, parking_count: 1 },
} as unknown as Contract;

describe("lease PDF", () => {
  it("formats Spanish dates and money", () => {
    expect(fechaLarga("2026-11-01")).toBe("1 de noviembre de 2026");
    expect(dinero(1150)).toBe("$1,150.00");
  });

  it("renders a PDF", async () => {
    const buf = await renderContractPdf(contract, { full_name: "María Rivera" } as never, [{ title: "Mascotas", body: "No se permiten mascotas." }]);
    expect(buf).not.toBeNull();
    expect(buf!.subarray(0, 4).toString()).toBe("%PDF");
    if (process.env.LEASE_PDF_OUT) (await import("node:fs")).writeFileSync(process.env.LEASE_PDF_OUT, buf!);
  });
});
