// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fakeSupabase";

// ── Module mocks (server actions + receipt rendering) ───────────────────────
const env = vi.hoisted(() => ({
  user: { id: "tenant-user" } as { id: string } | null,
  admin: null as unknown,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/rent/receipt-data", () => ({ receiptFor: async () => null, emailReceipt: async () => undefined }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: env.user } }) } }),
  createAdminClient: () => env.admin,
}));

import {
  ATH_BASE_URL,
  AthMovilError,
  authorizePayment,
  cancelPayment,
  createPayment,
  findPayment,
  normalizeAthPhone,
  refundPayment,
} from "@/lib/athmovil/client";
import { loadAthAccount, reconcileAthPayments, syncAthPayment, cancelAthPayment, STALE_AFTER_MS } from "@/lib/athmovil/service";
import { connectAthMovil, createAthPayment } from "@/lib/actions/athmovil";
import { encryptField, decryptField } from "@/lib/crypto/fields";
import { AthPaymentCreateSchema } from "@/lib/schemas";

const KEY = randomBytes(32).toString("base64");
beforeEach(() => vi.stubEnv("FIELD_ENCRYPTION_KEY", KEY));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type Call = { url: string; init: RequestInit };
const ok = (data: unknown) => new Response(JSON.stringify({ status: "success", data }), { status: 200, headers: { "content-type": "application/json" } });
const fail = (errorcode: string, message = "error", status = 400) =>
  new Response(JSON.stringify({ status: "error", message, errorcode, data: null }), { status, headers: { "content-type": "application/json" } });

function recorder(handler: (path: string, body: Record<string, unknown> | null, headers: Record<string, string>) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    await new Promise((r) => setTimeout(r, 1)); // let concurrent requests interleave
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    return handler(url.replace(ATH_BASE_URL, ""), body, (init.headers ?? {}) as Record<string, string>);
  }) as unknown as typeof fetch;
  return { f, calls };
}

// ── Client ──────────────────────────────────────────────────────────────────
describe("ATH Móvil client", () => {
  it("POST /payment sends the documented body and returns ecommerceId + auth_token", async () => {
    const { f, calls } = recorder(() => ok({ ecommerceId: "ec-1", auth_token: "tok-1" }));
    const res = await createPayment(
      {
        publicToken: "pub",
        total: 1150.004,
        phoneNumber: "7875550101",
        metadata1: "Renta 2026-10 de un nombre larguísimo que no cabe en cuarenta",
        metadata2: "Contrato 30000000",
        items: [{ name: "Renta", description: "Las Palmas 2B", quantity: "1", price: "1150.00", tax: "0.00", metadata: "Contrato 30000000" }],
      },
      { fetch: f }
    );
    expect(res).toEqual({ ecommerceId: "ec-1", authToken: "tok-1" });
    expect(calls[0].url).toBe(`${ATH_BASE_URL}/payment`);
    expect(calls[0].init.method).toBe("POST");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ publicToken: "pub", timeout: 600, total: 1150, subtotal: 1150, tax: 0, phoneNumber: "7875550101", metadata2: "Contrato 30000000" });
    expect(body.metadata1.length).toBeLessThanOrEqual(40);
    expect(body.items).toHaveLength(1);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("rejects totals outside $1–$1,500 without calling ATH", async () => {
    const { f, calls } = recorder(() => ok({}));
    const base = { publicToken: "p", phoneNumber: "7875550101", metadata1: "a", metadata2: "b", items: [] };
    await expect(createPayment({ ...base, total: 0.99 }, { fetch: f })).rejects.toMatchObject({ errorcode: "BTRA_0004" });
    await expect(createPayment({ ...base, total: 1500.01 }, { fetch: f })).rejects.toBeInstanceOf(AthMovilError);
    expect(calls).toHaveLength(0);
    expect(AthPaymentCreateSchema.safeParse({ contract_id: crypto.randomUUID(), amount: 1500.01, phone: "7875550101" }).success).toBe(false);
    expect(AthPaymentCreateSchema.safeParse({ contract_id: crypto.randomUUID(), amount: 0.5, phone: "7875550101" }).success).toBe(false);
    const p = AthPaymentCreateSchema.parse({ contract_id: crypto.randomUUID(), amount: 1500, phone: "+1 (787) 555-0101" });
    expect(p.phone).toBe("7875550101");
  });

  it("findPayment sends ecommerceId + publicToken and the bearer token when known", async () => {
    const { f, calls } = recorder(() => ok({ ecommerceStatus: "COMPLETED", referenceNumber: "402-abc", total: "25.50", fee: 0.5, netAmount: 25 }));
    const tx = await findPayment({ publicToken: "pub", ecommerceId: "ec-1", authToken: "tok" }, { fetch: f });
    expect(calls[0].url).toBe(`${ATH_BASE_URL}/business/findPayment`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ ecommerceId: "ec-1", publicToken: "pub" });
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(tx).toMatchObject({ ecommerceStatus: "COMPLETED", referenceNumber: "402-abc", total: 25.5, fee: 0.5, netAmount: 25 });
  });

  it("authorization uses only the bearer token, empty body; cancel and refund shapes", async () => {
    const { f, calls } = recorder((path) => (path === "/authorization" ? ok({ ecommerceStatus: "COMPLETED", referenceNumber: "R1", total: 10 }) : ok({})));
    const tx = await authorizePayment("tok-9", { fetch: f });
    expect(tx.referenceNumber).toBe("R1");
    expect(calls[0].url).toBe(`${ATH_BASE_URL}/authorization`);
    expect(calls[0].init.body).toBeUndefined();
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer tok-9");

    await cancelPayment({ publicToken: "pub", ecommerceId: "ec-1" }, { fetch: f });
    expect(calls[1].url).toBe(`${ATH_BASE_URL}/business/cancel`);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ ecommerceId: "ec-1", publicToken: "pub" });

    await refundPayment({ publicToken: "pub", privateToken: "priv", referenceNumber: "R1", amount: 10, message: "x".repeat(80) }, { fetch: f });
    const refund = JSON.parse(String(calls[2].init.body));
    expect(refund).toMatchObject({ publicToken: "pub", privateToken: "priv", referenceNumber: "R1", amount: 10 });
    expect(refund.message).toHaveLength(50);
  });

  it("parses the error envelope into AthMovilError with errorcode", async () => {
    const { f } = recorder(() => fail("BTRA_0031", "Ecommerce id not found"));
    const err = await findPayment({ publicToken: "p", ecommerceId: "x" }, { fetch: f }).catch((e) => e);
    expect(err).toBeInstanceOf(AthMovilError);
    expect(err.errorcode).toBe("BTRA_0031");
    expect(err.message).toBe("Ecommerce id not found");
    expect(err.httpStatus).toBe(400);
  });

  it("treats non-JSON and 200-with-error bodies as errors", async () => {
    const html = recorder(() => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(findPayment({ publicToken: "p", ecommerceId: "x" }, { fetch: html.f })).rejects.toMatchObject({ errorcode: null, httpStatus: 502 });
    const soft = recorder(() => new Response(JSON.stringify({ status: "error", message: "Expired", errorcode: "BTRA_0039", data: null }), { status: 200 }));
    await expect(authorizePayment("t", { fetch: soft.f })).rejects.toMatchObject({ errorcode: "BTRA_0039" });
  });

  it("aborts after ~15 s", async () => {
    vi.useFakeTimers();
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch;
    const p = findPayment({ publicToken: "p", ecommerceId: "x" }, { fetch: hang }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(15_001);
    const err = await p;
    expect(err).toBeInstanceOf(AthMovilError);
    expect(err.errorcode).toBeNull();
    expect(err.message).toMatch(/a tiempo/);
  });

  it("normalizes ATH phone numbers", () => {
    expect(normalizeAthPhone("+1 (787) 555-0101")).toBe("7875550101");
    expect(normalizeAthPhone("939-555-0101")).toBe("9395550101");
    expect(normalizeAthPhone("555-0101")).toBeNull();
    expect(normalizeAthPhone(null)).toBeNull();
  });
});

// ── State machine ───────────────────────────────────────────────────────────
const OWNER = "11111111-1111-4111-8111-111111111111";
const CONTRACT = "33333333-3333-4333-8333-333333333333";
const PAYER = "tenant-user";

/** fakeSupabase + the unique index on payments.external_id. */
function db(rows: Record<string, Record<string, unknown>[]> = {}) {
  const fake = fakeSupabase({
    ath_movil_accounts: [{ owner_id: OWNER, public_token_enc: encryptField("pub-token-123"), private_token_enc: null, business_name: "Rivera Rentals" }],
    payments: [],
    ...rows,
  });
  const from = fake.client.from;
  (fake.client as { from: unknown }).from = (table: string) => {
    const b = from(table) as Record<string, unknown>;
    if (table === "payments") {
      const insert = b.insert as (p: Record<string, unknown>) => unknown;
      b.insert = (p: Record<string, unknown>) => {
        if (p.external_id && fake.tables.payments.some((r) => r.external_id === p.external_id)) {
          const res = { data: null, error: { code: "23505", message: "duplicate key" } };
          const e: Record<string, unknown> = { select: () => e, single: async () => res, then: (ok: (v: unknown) => void) => ok(res) };
          return e;
        }
        return insert(p);
      };
    }
    return b;
  };
  return { ...fake, admin: fake.client as unknown as Parameters<typeof syncAthPayment>[0] };
}

function attempt(extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    owner_id: OWNER,
    contract_id: CONTRACT,
    payer_user_id: PAYER,
    phone: "7875550101",
    amount: 1150,
    ecommerce_id: "ec-1",
    auth_token_enc: encryptField("auth-tok"),
    status: "open",
    authorizing_at: null,
    reference_number: null,
    payment_id: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

/** A tiny ATH: CONFIRM until /authorization is called once, then COMPLETED. */
function athServer(initial: "OPEN" | "CONFIRM" | "COMPLETED" | "CANCEL") {
  const state = { status: initial as string, authorizations: 0, cancels: 0 };
  const rec = recorder((path, _body, headers) => {
    if (path === "/business/findPayment") return ok({ ecommerceStatus: state.status, referenceNumber: state.status === "COMPLETED" ? "REF-77" : null, total: 1150 });
    if (path === "/authorization") {
      expect(headers.authorization).toBe("Bearer auth-tok");
      state.authorizations++;
      if (state.status !== "CONFIRM") return fail("BTRA_0032", "Not confirmed");
      state.status = "COMPLETED";
      return ok({ ecommerceStatus: "COMPLETED", referenceNumber: "REF-77", total: 1150, fee: 0, netAmount: 1150 });
    }
    if (path === "/business/cancel") {
      state.cancels++;
      state.status = "CANCEL";
      return ok({});
    }
    return fail("X", "unexpected");
  });
  return { state, ...rec };
}

describe("ATH payment state machine", () => {
  it("OPEN → CONFIRM → authorize → COMPLETED posts exactly once, even with concurrent checks", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const ath = athServer("OPEN");
    const sendReceipt = vi.fn(async () => undefined);
    const deps = { fetch: ath.f, sendReceipt };

    expect((await syncAthPayment(d.admin, row.id, deps))?.status).toBe("open");
    ath.state.status = "CONFIRM";
    const [a, b] = await Promise.all([syncAthPayment(d.admin, row.id, deps), syncAthPayment(d.admin, row.id, deps)]);
    expect([a?.status, b?.status]).toContain("completed");
    expect(ath.state.authorizations).toBe(1);

    // Further polls (and the cron) change nothing.
    await Promise.all([syncAthPayment(d.admin, row.id, deps), syncAthPayment(d.admin, row.id, deps)]);
    await reconcileAthPayments(d.admin, deps);

    expect(d.tables.payments).toHaveLength(1);
    const p = d.tables.payments[0];
    expect(p).toMatchObject({ contract_id: CONTRACT, owner_id: OWNER, amount: 1150, method: "ath_movil", source: "ath_movil", external_id: "athm:REF-77", reference: "REF-77" });
    expect(p.received_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sendReceipt).toHaveBeenCalledTimes(1);
    const stored = d.tables.ath_movil_payments[0];
    expect(stored).toMatchObject({ status: "completed", payment_id: p.id, reference_number: "REF-77" });
  });

  it("two checks that both see COMPLETED post one payment and one receipt", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const ath = athServer("COMPLETED");
    const sendReceipt = vi.fn(async () => undefined);
    await Promise.all([syncAthPayment(d.admin, row.id, { fetch: ath.f, sendReceipt }), syncAthPayment(d.admin, row.id, { fetch: ath.f, sendReceipt })]);
    expect(d.tables.payments).toHaveLength(1);
    expect(sendReceipt).toHaveBeenCalledTimes(1);
    expect(ath.state.authorizations).toBe(0);
  });

  it("falls back to the ecommerceId when ATH gives no reference number", async () => {
    const row = attempt({ status: "confirm" });
    const d = db({ ath_movil_payments: [row] });
    const { f } = recorder((path) =>
      path === "/business/findPayment" ? ok({ ecommerceStatus: "COMPLETED", total: 1150 }) : fail("X")
    );
    await syncAthPayment(d.admin, row.id, { fetch: f, sendReceipt: async () => undefined });
    expect(d.tables.payments[0].external_id).toBe("athm:ec-1");
  });

  it("CANCEL closes the attempt without posting", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const ath = athServer("CANCEL");
    expect((await syncAthPayment(d.admin, row.id, { fetch: ath.f }))?.status).toBe("cancel");
    expect(d.tables.payments).toHaveLength(0);
    // Terminal: no more calls to ATH.
    const before = ath.calls.length;
    await syncAthPayment(d.admin, row.id, { fetch: ath.f });
    expect(ath.calls.length).toBe(before);
  });

  it("an expired payment (BTRA_0039) is marked cancelled", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const { f } = recorder(() => fail("BTRA_0039", "Transaction expired"));
    expect((await syncAthPayment(d.admin, row.id, { fetch: f }))?.status).toBe("cancel");
  });

  it("transient ATH errors leave the attempt open", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const { f } = recorder(() => new Response("oops", { status: 503 }));
    const v = await syncAthPayment(d.admin, row.id, { fetch: f });
    expect(v?.status).toBe("open");
    expect(v?.error).toBeTruthy();
  });

  it("the tenant can cancel while open", async () => {
    const row = attempt();
    const d = db({ ath_movil_payments: [row] });
    const ath = athServer("OPEN");
    expect((await cancelAthPayment(d.admin, row.id, { fetch: ath.f }))?.status).toBe("cancel");
    expect(ath.state.cancels).toBe(1);
  });

  it("the cron completes forgotten payments and cancels stale open ones", async () => {
    const now = new Date();
    const confirmed = attempt({ ecommerce_id: "ec-confirm" });
    const stale = attempt({ ecommerce_id: "ec-stale", created_at: new Date(now.getTime() - STALE_AFTER_MS - 60_000).toISOString() });
    const old = attempt({ ecommerce_id: "ec-old", created_at: new Date(now.getTime() - 2 * 86_400_000).toISOString() });
    const d = db({ ath_movil_payments: [confirmed, stale, old] });
    const status: Record<string, string> = { "ec-confirm": "CONFIRM", "ec-stale": "OPEN", "ec-old": "OPEN" };
    const { f } = recorder((path, body) => {
      const id = String(body?.ecommerceId ?? "ec-confirm");
      if (path === "/business/findPayment") return ok({ ecommerceStatus: status[id], referenceNumber: status[id] === "COMPLETED" ? `R-${id}` : null, total: 1150 });
      if (path === "/authorization") return (status["ec-confirm"] = "COMPLETED"), ok({ ecommerceStatus: "COMPLETED", referenceNumber: "R-ec-confirm", total: 1150 });
      if (path === "/business/cancel") return (status[id] = "CANCEL"), ok({});
      return fail("X");
    });
    const res = await reconcileAthPayments(d.admin, { fetch: f, sendReceipt: async () => undefined, now });
    expect(res).toMatchObject({ checked: 2, completed: 1, cancelled: 1, errors: [] });
    expect(d.tables.payments).toHaveLength(1);
    expect(d.tables.ath_movil_payments.find((r) => r.ecommerce_id === "ec-old")?.status).toBe("open"); // outside the 1-day window
  });

  it("ignores a token stored unencrypted", async () => {
    const d = db({ ath_movil_accounts: [{ owner_id: OWNER, public_token_enc: "plain-token", private_token_enc: null, business_name: null }] });
    expect(await loadAthAccount(d.admin, OWNER)).toBeNull();
  });
});

// ── Server actions ──────────────────────────────────────────────────────────
describe("connectAthMovil", () => {
  it("refuses to store tokens without FIELD_ENCRYPTION_KEY", async () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
    const d = db({ ath_movil_accounts: [] });
    env.admin = d.admin;
    env.user = { id: OWNER };
    const res = await connectAthMovil({ public_token: "pub-token-123456", private_token: "priv-token-123456" });
    expect(res.ok).toBe(false);
    expect(d.tables.ath_movil_accounts).toHaveLength(0);
  });

  it("stores tokens only encrypted", async () => {
    const d = db({ ath_movil_accounts: [] });
    env.admin = d.admin;
    env.user = { id: OWNER };
    expect(await connectAthMovil({ public_token: "pub-token-123456", private_token: "", business_name: "Rivera" })).toEqual({ ok: true });
    const acct = d.tables.ath_movil_accounts[0];
    expect(String(acct.public_token_enc)).toMatch(/^enc:v1:/);
    expect(JSON.stringify(acct)).not.toContain("pub-token-123456");
    expect(decryptField(acct.public_token_enc)).toBe("pub-token-123456");
    expect(acct.private_token_enc).toBeNull();
  });
});

describe("createAthPayment", () => {
  function leaseDb() {
    const d = db({
      tenant_invites: [{ id: "inv", contract_id: CONTRACT, owner_id: OWNER, used_by: PAYER, used: true }],
      contracts: [{ id: CONTRACT, owner_id: OWNER, status: "signed", unit_number: "2B" }],
      rent_ledgers: [{ contract_id: CONTRACT, owner_id: OWNER, started_on: "2026-01-01", late_fees: false }],
      rent_charges: [{ id: "c1", contract_id: CONTRACT, kind: "rent", period: "2026-01-01", due_date: "2026-01-01", amount: 1150, voided_at: null }],
      ath_movil_payments: [],
    });
    env.admin = d.admin;
    env.user = { id: PAYER };
    return d;
  }

  it("starts the payment at ATH and stores the attempt with the auth token encrypted", async () => {
    const d = leaseDb();
    const ath = recorder(() => ok({ ecommerceId: "ec-new", auth_token: "secret-auth" }));
    vi.stubGlobal("fetch", ath.f);
    const res = await createAthPayment({ contract_id: CONTRACT, amount: 1150, phone: "(787) 555-0101" });
    expect(res).toMatchObject({ ok: true, amount: 1150, business: "Rivera Rentals" });
    const body = JSON.parse(String(ath.calls[0].init.body));
    expect(body).toMatchObject({ publicToken: "pub-token-123", total: 1150, phoneNumber: "7875550101" });
    expect(body.metadata1).toMatch(/^Renta \d{4}-\d{2}$/);
    expect(body.metadata2.length).toBeLessThanOrEqual(40);
    const row = d.tables.ath_movil_payments[0];
    expect(row).toMatchObject({ ecommerce_id: "ec-new", status: "open", payer_user_id: PAYER, owner_id: OWNER });
    expect(String(row.auth_token_enc)).toMatch(/^enc:v1:/);
    expect(decryptField(row.auth_token_enc)).toBe("secret-auth");
  });

  it("rejects amounts above the balance and tenants without the lease", async () => {
    leaseDb();
    const ath = recorder(() => ok({ ecommerceId: "x", auth_token: "y" }));
    vi.stubGlobal("fetch", ath.f);
    expect(await createAthPayment({ contract_id: CONTRACT, amount: 1200, phone: "7875550101" })).toMatchObject({ ok: false });
    env.user = { id: "someone-else" };
    expect(await createAthPayment({ contract_id: CONTRACT, amount: 100, phone: "7875550101" })).toEqual({ ok: false, error: "Contrato no encontrado." });
    expect(ath.calls).toHaveLength(0);
  });
});
