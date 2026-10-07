// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal Supabase mock: per-table rows for reads, records writes.
const state = {
  user: { id: "u1" } as { id: string } | null,
  rows: {} as Record<string, Record<string, unknown> | null>,
  writes: [] as { table: string; op: string; payload: unknown }[],
};

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = chain;
  b.eq = chain;
  b.in = chain;
  b.insert = (payload: unknown) => { state.writes.push({ table, op: "insert", payload }); return b; };
  b.update = (payload: unknown) => { state.writes.push({ table, op: "update", payload }); return b; };
  b.delete = () => { state.writes.push({ table, op: "delete", payload: null }); return b; };
  b.maybeSingle = async () => ({ data: state.rows[table] ?? null, error: null });
  b.single = async () => ({ data: { id: "new-id" }, error: null });
  b.then = (resolve: (v: unknown) => void) =>
    resolve({ data: state.rows[table] ? [state.rows[table]] : [], error: null });
  return b;
}

vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (t: string) => builder(t),
  }),
}));

import { saveContract } from "@/lib/actions/contracts";
import { createTenant, createProperty } from "@/lib/actions/records";

const P = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const contract = {
  property_id: P,
  tenant_id: T,
  contract_type: "lease" as const,
  lease_start: "2026-11-01",
  lease_end: "2027-10-31",
  lease_months: 12,
  rent_amount: 900,
  security_deposit: 900,
  payment_due_day: 1,
  late_fee_day: 5,
  occupant_names: [],
  occupant_count: 1,
  key_count: 2,
};

beforeEach(() => {
  state.user = { id: "u1" };
  state.writes = [];
  state.rows = {
    properties: { id: P, name: "Casa", address: "Calle 1", city: "San Juan", state: "PR" },
    tenants: { id: T, full_name: "Ana", email: "ana@example.com" },
  };
});

describe("saveContract", () => {
  it("rejects a zero rent before touching the database", async () => {
    const r = await saveContract({ contract: { ...contract, rent_amount: 0 }, coTenants: [], sections: [] });
    expect(r).toEqual({ ok: false, error: "Revisa el campo: renta mensual." });
    expect(state.writes).toHaveLength(0);
  });

  it("refuses to modify a signed contract", async () => {
    state.rows.contracts = { status: "signed" };
    const r = await saveContract({ id: C, contract, coTenants: [], sections: [] });
    expect(r.ok).toBe(false);
    expect(state.writes.filter((w) => w.table === "contracts")).toHaveLength(0);
  });

  it("sets owner, status and snapshots on the server", async () => {
    const r = await saveContract({
      contract: { ...contract, landlord_signature: "x", tenant_signature: "y" },
      coTenants: [],
      sections: [],
    });
    expect(r).toEqual({ ok: true, id: "new-id" });
    const insert = state.writes.find((w) => w.table === "contracts" && w.op === "insert")!.payload as Record<string, unknown>;
    expect(insert.owner_id).toBe("u1");
    expect(insert.status).toBe("signed");
    expect((insert.tenant_snapshot as Record<string, unknown>).full_name).toBe("Ana");
    expect((insert.property_snapshot as Record<string, unknown>).name).toBe("Casa");
  });

  it("requires a session", async () => {
    state.user = null;
    const r = await saveContract({ contract, coTenants: [], sections: [] });
    expect(r.ok).toBe(false);
  });
});

describe("record actions", () => {
  it("stores blank optional fields as null and stamps the owner", async () => {
    const r = await createTenant({ full_name: "Luis", email: "", phone: "" });
    expect(r.ok).toBe(true);
    const insert = state.writes[0].payload as Record<string, unknown>;
    expect(insert).toMatchObject({ full_name: "Luis", email: null, phone: null, owner_id: "u1" });
  });

  it("ignores a client-supplied owner_id", async () => {
    await createProperty({ name: "A", address: "B", city: "C", state: "PR", owner_id: "attacker" });
    expect((state.writes[0].payload as Record<string, unknown>).owner_id).toBe("u1");
  });

  it("rejects an invalid unit count", async () => {
    const r = await createProperty({ name: "A", address: "B", city: "C", state: "PR", unit_count: 0 });
    expect(r.ok).toBe(false);
    expect(state.writes).toHaveLength(0);
  });
});
