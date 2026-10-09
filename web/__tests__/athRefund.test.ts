import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fakeSupabase";
import { encryptField } from "@/lib/crypto/fields";
import { clearUnknownRefund, refundAthPayment } from "@/lib/athmovil/refund";

const OWNER = "11111111-1111-4111-8111-111111111111";
const C = "33333333-3333-4333-8333-333333333333";
const PAY = "44444444-4444-4444-8444-444444444444";

beforeEach(() => vi.stubEnv("FIELD_ENCRYPTION_KEY", randomBytes(32).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

function setup(opts: { privateToken?: boolean } = {}) {
  return fakeSupabase({
    payments: [{ id: PAY, owner_id: OWNER, contract_id: C, amount: 1150, source: "ath_movil", external_id: "athm:ATH-1", voided_at: null }],
    ath_movil_payments: [{ id: "ap1", payment_id: PAY, reference_number: "ATH-1" }],
    ath_movil_accounts: [
      { owner_id: OWNER, public_token_enc: encryptField("pub-token-123"), private_token_enc: opts.privateToken === false ? null : encryptField("priv-token-456"), business_name: "Rivera" },
    ],
    ath_movil_refunds: [],
    rent_charges: [],
  });
}

const okFetch = (ref = "RF-9") =>
  vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { refund: { status: "COMPLETED", referenceNumber: ref }, originalTransaction: {} } }), { status: 200 }));

describe("ATH Móvil refunds", () => {
  it("full refund voids the payment and records the refund reference", async () => {
    const db = setup();
    const fetch = okFetch();
    const res = await refundAthPayment(db.client as never, { ownerId: OWNER, paymentId: PAY, amount: 1150, message: "Duplicado" }, { fetch });
    expect(res).toEqual({ ok: true, refunded: 1150, fullyRefunded: true });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ publicToken: "pub-token-123", privateToken: "priv-token-456", referenceNumber: "ATH-1", message: "Duplicado" });
    expect(db.tables.payments[0].voided_at).toBeTruthy();
    expect(db.tables.payments[0].void_reason).toBe("Reembolso ATH Móvil (RF-9)");
    expect(db.tables.ath_movil_refunds[0]).toMatchObject({ status: "completed", refund_reference: "RF-9", amount: 1150 });
  });

  it("partial refund adds a charge and limits later refunds to the rest", async () => {
    const db = setup();
    const res = await refundAthPayment(db.client as never, { ownerId: OWNER, paymentId: PAY, amount: 150 }, { fetch: okFetch() });
    expect(res).toMatchObject({ ok: true, fullyRefunded: false });
    expect(db.tables.payments[0].voided_at).toBeNull();
    expect(db.tables.rent_charges[0]).toMatchObject({ kind: "other", amount: 150, contract_id: C, description: "Reembolso ATH Móvil (RF-9)" });
    const over = await refundAthPayment(db.client as never, { ownerId: OWNER, paymentId: PAY, amount: 1001 }, { fetch: okFetch() });
    expect(over).toMatchObject({ ok: false, code: "amount" });
  });

  it("refuses another owner's payment, missing private token, and bad amounts", async () => {
    expect(await refundAthPayment(setup().client as never, { ownerId: "someone-else", paymentId: PAY, amount: 10 }, { fetch: okFetch() })).toMatchObject({ code: "not_found" });
    expect(await refundAthPayment(setup({ privateToken: false }).client as never, { ownerId: OWNER, paymentId: PAY, amount: 10 }, { fetch: okFetch() })).toMatchObject({ code: "no_private_token" });
    expect(await refundAthPayment(setup().client as never, { ownerId: OWNER, paymentId: PAY, amount: 0 }, { fetch: okFetch() })).toMatchObject({ code: "amount" });
  });

  it("an API rejection is retryable; no answer blocks until cleared", async () => {
    const db = setup();
    const rejected = vi.fn(async () => new Response(JSON.stringify({ status: "error", message: "Monto excede", errorcode: "BTRA_0004", data: null }), { status: 400 }));
    expect(await refundAthPayment(db.client as never, { ownerId: OWNER, paymentId: PAY, amount: 10 }, { fetch: rejected })).toMatchObject({ ok: false, code: "failed" });
    expect(db.tables.ath_movil_refunds[0].status).toBe("failed");

    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await refundAthPayment(db.client as never, { ownerId: OWNER, paymentId: PAY, amount: 10 }, { fetch: down })).toMatchObject({ ok: false, code: "unknown" });
    const unknown = db.tables.ath_movil_refunds.find((r) => r.status === "unknown")!;
    expect(await clearUnknownRefund(db.client as never, "someone-else", unknown.id as string)).toBe(false);
    expect(await clearUnknownRefund(db.client as never, OWNER, unknown.id as string)).toBe(true);
    expect(unknown.status).toBe("failed");
  });
});
