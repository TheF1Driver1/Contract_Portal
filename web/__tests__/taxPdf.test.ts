// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAnnualPackage } from "@/lib/tax/annual";
import { renderAnnualPdf, taxT } from "@/lib/tax/pdf";

const pkg = buildAnnualPackage({
  year: 2026,
  properties: [{ id: "p1", name: "Edificio Las Palmas", address: "Calle Loíza 1850", city: "San Juan" }],
  contracts: [{ id: "c1", property_id: "p1", status: "signed", rent_amount: 1150, lease_start: "2025-01-01", lease_end: "2027-01-01" }],
  ledgerContractIds: ["c1"],
  payments: [{ contract_id: "c1", amount: 1150, received_on: "2026-02-03", voided_at: null }],
  expenses: [{ property_id: "p1", category: "repairs", amount: 240, expense_date: "2026-03-01" }],
  crimBills: [{ property_id: "p1", amount: 715, paid_on: "2026-01-10", expense_id: null, voided_at: null }],
  taxInputs: [{ property_id: "p1", purchase_price: 250000, building_pct: 80, placed_in_service: "2021-05-01" }],
});

describe("annual package PDF", () => {
  for (const [locale, view] of [["es", "anejo_n"], ["en", "schedule_e"]] as const) {
    it(`renders in ${locale} (${view})`, async () => {
      const buf = await renderAnnualPdf({ pkg, view, locale, ownerName: "María Rivera", propertyLabel: "Todas" });
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(1500);
    });
  }

  it("translates the CPA notice in both languages", () => {
    expect(taxT("es").t("reviewNotice.title")).toBe("Pendiente de revisión por un CPA");
    expect(taxT("en").t("reviewNotice.title")).toBe("Pending review by a CPA");
    expect(taxT(null).lang).toBe("es");
  });
});
