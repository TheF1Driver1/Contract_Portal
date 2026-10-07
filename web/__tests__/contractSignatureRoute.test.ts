// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock: records every update() payload and filter ─────────────────
const state = {
  user: { id: "u1" } as { id: string } | null,
  contract: { id: "c1", status: "signed" } as { id: string; status: string } | null,
  updates: [] as Record<string, unknown>[],
  filters: [] as [string, unknown][],
};

function builder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.update = (payload: Record<string, unknown>) => {
    state.updates.push(payload);
    return b;
  };
  b.eq = (col: string, val: unknown) => {
    state.filters.push([col, val]);
    return b;
  };
  b.maybeSingle = async () => ({ data: state.contract, error: null });
  b.then = (resolve: (v: unknown) => void) => resolve({ error: null });
  return b;
}

vi.mock("@/lib/supabase-server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => builder(),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimitWrite: async () => null }));

import { POST, DELETE } from "@/app/api/contracts/[id]/signature/route";

const SIG = "data:image/png;base64," + "A".repeat(200);
const params = { params: Promise.resolve({ id: "c1" }) };

function post(body: unknown) {
  return POST(
    new Request("http://x/api/contracts/c1/signature", { method: "POST", body: JSON.stringify(body) }),
    params
  );
}

function del(role: string) {
  return DELETE(new Request(`http://x/api/contracts/c1/signature?role=${role}`, { method: "DELETE" }), params);
}

beforeEach(() => {
  state.user = { id: "u1" };
  state.contract = { id: "c1", status: "signed" };
  state.updates = [];
  state.filters = [];
});

describe("POST /api/contracts/[id]/signature", () => {
  it("rejects unauthenticated requests", async () => {
    state.user = null;
    expect((await post({ role: "landlord", signature: SIG })).status).toBe(401);
  });

  it("rejects non-image signatures and unknown roles", async () => {
    expect((await post({ role: "landlord", signature: "x".repeat(200) })).status).toBe(400);
    expect((await post({ role: "manager", signature: SIG })).status).toBe(400);
    expect(state.updates).toHaveLength(0);
  });

  it("saves only the landlord signature for role=landlord", async () => {
    const res = await post({ role: "landlord", signature: SIG });
    expect(res.status).toBe(200);
    expect(state.updates).toEqual([{ landlord_signature: SIG }]);
    expect(state.filters).toContainEqual(["owner_id", "u1"]);
  });

  it("marks the contract signed for an in-person tenant signature", async () => {
    await post({ role: "tenant", signature: SIG });
    expect(state.updates[0]).toMatchObject({ tenant_signature: SIG, status: "signed" });
    expect(typeof state.updates[0].signed_at).toBe("string");
  });

  it("returns 404 when the contract is not owned by the user", async () => {
    state.contract = null;
    expect((await post({ role: "landlord", signature: SIG })).status).toBe(404);
  });
});

describe("DELETE /api/contracts/[id]/signature", () => {
  it("clears the landlord signature only", async () => {
    expect((await del("landlord")).status).toBe(204);
    expect(state.updates).toEqual([{ landlord_signature: null }]);
  });

  it("un-signs a signed contract when the tenant signature is removed", async () => {
    await del("tenant");
    expect(state.updates).toEqual([{ tenant_signature: null, signed_at: null, status: "sent" }]);
  });

  it("leaves status alone when the contract was not signed", async () => {
    state.contract = { id: "c1", status: "draft" };
    await del("tenant");
    expect(state.updates).toEqual([{ tenant_signature: null, signed_at: null }]);
  });

  it("rejects an invalid role", async () => {
    expect((await del("bogus")).status).toBe(400);
  });

  it("returns 404 for a contract the user does not own", async () => {
    state.contract = null;
    expect((await del("landlord")).status).toBe(404);
  });
});
