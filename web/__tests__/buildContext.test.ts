import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { check, MONTHS_ES, buildContext } from "@/app/api/generate/route";
import type { Contract } from "@/lib/types";

// Minimal contract fixture
function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    owner_id: "u1",
    property_id: "p1",
    tenant_id: "t1",
    contract_type: "lease",
    status: "draft",
    unit_number: "2A",
    lease_start: "2026-01-15",
    lease_end: "2026-12-15",
    lease_months: 12,
    rent_amount: 1200,
    rent_amount_verbal: "twelve hundred",
    security_deposit: 1200,
    payment_due_day: 1,
    late_fee_day: 5,
    occupant_names: ["John Doe"],
    occupant_count: 1,
    amenities: {
      room_count: 2,
      fan_count: 3,
      stool_count: 2,
      stove_count: 1,
      mirror_doors: true,
      renovated_bathroom: false,
      microwave: true,
      fridge: true,
      ac: false,
      mini_blinds: true,
      sofa: false,
      futon: false,
      wall_art: false,
      parking: true,
    },
    key_count: 2,
    landlord_signature: null,
    tenant_signature: null,
    signed_at: null,
    docx_url: null,
    pdf_url: null,
    sent_at: null,
    opened_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    tenant: {
      id: "t1",
      owner_id: "u1",
      full_name: "Jane Smith",
      email: "jane@example.com",
      phone: null,
      ssn_last4: "4567",
      license_number: "D123456",
      current_address: "123 Main St",
      created_at: "2026-01-01T00:00:00Z",
    },
    property: {
      id: "p1",
      owner_id: "u1",
      name: "Sabana Gardens",
      address: "456 Oak Ave",
      city: "San Juan",
      state: "PR",
      zip: "00901",
      unit_count: 10,
      created_at: "2026-01-01T00:00:00Z",
    },
    ...overrides,
  };
}

describe("check()", () => {
  it("returns checkmark for truthy", () => {
    expect(check(true)).toBe("✔");
  });

  it("returns blank line for falsy", () => {
    expect(check(false)).toBe("__________");
    expect(check(undefined)).toBe("__________");
  });
});

describe("MONTHS_ES", () => {
  it("has 13 entries (index 0 empty, 1-12 months)", () => {
    expect(MONTHS_ES).toHaveLength(13);
    expect(MONTHS_ES[0]).toBe("");
    expect(MONTHS_ES[1]).toBe("enero");
    expect(MONTHS_ES[12]).toBe("diciembre");
  });

  it("covers all months in order", () => {
    const expected = [
      "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    expect(MONTHS_ES).toEqual(expected);
  });
});

describe("buildContext()", () => {
  beforeEach(() => {
    // Fix "today" to 2026-04-18 so date assertions are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats today's date in Spanish", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.dia).toBe("18");
    expect(ctx.mes).toBe("abril");
    expect(ctx.anio).toBe("2026");
  });

  it("formats tenant fields correctly", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.nombre_arrendatario).toBe("Jane Smith");
    expect(ctx.seguro_social).toBe("xxx-xx-4567");
    expect(ctx.numero_licencia).toBe("D123456");
    expect(ctx.residencia_actual).toBe("123 Main St");
  });

  it("uses placeholder SSN when ssn_last4 missing", () => {
    const ctx = buildContext(makeContract({ tenant: undefined }));
    expect(ctx.seguro_social).toBe("xxx-xx-xxxx");
    expect(ctx.nombre_arrendatario).toBe("");
  });

  it("maps amenity booleans through check()", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.tiene_puertas_de_espejo).toBe("✔");    // mirror_doors: true
    expect(ctx.tiene_bano_remodelado).toBe("__________"); // renovated_bathroom: false
    expect(ctx.tiene_microondas).toBe("✔");           // microwave: true
    expect(ctx.tiene_nevera).toBe("✔");               // fridge: true
    expect(ctx.tiene_aire_acondicionado).toBe("__________"); // ac: false
    expect(ctx.incluye_estacionamiento).toBe("✔");    // parking: true
  });

  it("maps amenity counts as strings", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.cantidad_cuartos).toBe("2");
    expect(ctx.cantidad_abanicos_techo).toBe("3");
    expect(ctx.cantidad_stools).toBe("2");
    expect(ctx.cantidad_estufas).toBe("1");
    expect(ctx.cantidad_llaves).toBe("2");
  });

  it("formats lease start/end dates in Spanish", () => {
    const ctx = buildContext(makeContract());
    // lease_start: 2026-01-15 (mid-month avoids UTC timezone boundary issues)
    expect(ctx.dia_comienzo_contrato).toBe("15");
    expect(ctx.mes_comienzo_contrato).toBe("enero");
    expect(ctx.anio_comienzo_contrato).toBe("2026");
    // lease_end: 2026-12-15
    expect(ctx.dia_que_culmina_contrato).toBe("15");
    expect(ctx.mes_que_culmina_contrato).toBe("diciembre");
    expect(ctx.anio_que_culmina_contrato).toBe("2026");
  });

  it("calculates lease years from months", () => {
    const ctx = buildContext(makeContract({ lease_months: 24 }));
    expect(ctx.cantidad_de_anios_contrato).toBe("2");
    expect(ctx.cantidad_de_meses_contrato).toBe("24");
  });

  it("formats payment fields", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.canon_arrendamiento_numero).toBe("1200");
    expect(ctx.canon_arrendamiento_verbal).toBe("twelve hundred");
    expect(ctx.cantidad_pago_firma).toBe("1200");
    expect(ctx.dia_pago_tarde).toBe("5");
  });

  it("uses signature placeholders", () => {
    const ctx = buildContext(makeContract());
    expect(ctx.firma_arrendador).toBe("_________________________");
    expect(ctx.firma_arrendatario).toBe("_________________________");
  });

  it("defaults amenity counts to 0 or 1 when amenities empty", () => {
    const ctx = buildContext(makeContract({ amenities: {} }));
    expect(ctx.cantidad_cuartos).toBe("1");      // default 1
    expect(ctx.cantidad_abanicos_techo).toBe("0"); // default 0
    expect(ctx.cantidad_stools).toBe("0");
    expect(ctx.cantidad_estufas).toBe("1");
    expect(ctx.tiene_puertas_de_espejo).toBe("__________"); // undefined → false
  });
});
