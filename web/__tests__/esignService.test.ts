// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./helpers/fakeSupabase";

const sent = { emails: [] as { to: string; subject: string; attachments?: unknown[] }[], sms: [] as { to: string; body: string }[] };
vi.mock("@/lib/notify", () => ({
  sendResendEmail: async (to: string, subject: string, _html: string, attachments?: unknown[]) => {
    sent.emails.push({ to, subject, attachments });
  },
  sendTwilioSms: async (to: string, body: string) => {
    sent.sms.push({ to, body });
  },
}));
vi.mock("@/lib/entitlements", () => ({ getPlan: async () => "propietario", hasFeature: () => true }));

import {
  recordConsent,
  requestSignatures,
  sendCode,
  sign,
  signerFromToken,
  verifyCode,
  maybeSeal,
} from "@/lib/esign/service";
import { hashToken } from "@/lib/esign/crypto";

const OWNER = "11111111-1111-4111-8111-111111111111";
const C = "33333333-3333-4333-8333-333333333333";
const meta = { ip: "203.0.113.5", userAgent: "vitest" };
const PNG = "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(200, 1)]).toString("base64");

function setup() {
  const contract: Record<string, unknown> & { status: string; rent_amount: number } = {
    id: C,
    owner_id: OWNER,
    status: "draft",
    contract_type: "lease",
    lease_start: "2026-11-01",
    lease_end: "2027-10-31",
    lease_months: 12,
    rent_amount: 1150,
    security_deposit: 1150,
    payment_due_day: 1,
    late_fee_day: 6,
    late_fee_type: "fixed",
    late_fee_grace_period_days: 5,
    late_fee_fixed_amount: 50,
    late_fee_daily_amount: 0,
    occupant_names: [],
    occupant_count: 2,
    key_count: 2,
    amenities: {},
    governing_law: "codigo_civil_pr_2020",
    landlord_signature: null,
    tenant_snapshot: { full_name: "José Martínez" },
    property_snapshot: { name: "Las Palmas 2B", address: "Calle Loíza 1850", city: "San Juan" },
    tenant: { full_name: "José Martínez", email: "jose@test", phone: "+17875550101", preferred_locale: "es" },
    occupants: [{ role: "co_tenant", full_name: "Ana Colón", email: "ana@test", phone: null }],
    document_sha256: null,
    sealed_pdf_path: null,
  };
  const db = fakeSupabase({
    contracts: [contract],
    contract_custom_sections: [],
    profiles: [{ id: OWNER, full_name: "María Rivera", email: "maria@test", locale: "es" }],
    contract_signers: [],
    signature_events: [],
  });
  return { db, admin: db.client as never, contract };
}

/** Reads the token sent in the latest signing email/SMS. */
const lastToken = () => {
  const body = sent.sms.at(-1)?.body ?? "";
  const m = /\/sign\/([A-Za-z0-9_-]+)/.exec(body);
  if (!m) throw new Error("no token sent");
  return m[1];
};

beforeEach(() => {
  sent.emails = [];
  sent.sms = [];
});

describe("e-sign service", () => {
  it("requests signatures in order and stores only token hashes", async () => {
    const { db, admin } = setup();
    const signers = await requestSignatures(admin, { contractId: C, ownerId: OWNER, appUrl: "https://app.test", meta });
    expect(signers.map((s) => [s.role, s.sign_order])).toEqual([["tenant", 1], ["co_tenant", 2]]);
    expect(db.tables.contracts[0].status).toBe("sent");
    expect(db.tables.contracts[0].document_sha256).toMatch(/^[0-9a-f]{64}$/);
    // Only the first signer is notified; the token itself is never stored.
    expect(sent.emails.map((e) => e.to)).toEqual(["jose@test"]);
    const token = lastToken();
    expect(JSON.stringify(db.tables.contract_signers)).not.toContain(token);
    expect(db.tables.contract_signers[0].token_hash).toBe(hashToken(token));
  });

  it("refuses another owner and signed contracts", async () => {
    const { admin, contract } = setup();
    await expect(requestSignatures(admin, { contractId: C, ownerId: "someone-else", appUrl: "x", meta })).rejects.toMatchObject({ code: "not_found" });
    contract.status = "signed";
    await expect(requestSignatures(admin, { contractId: C, ownerId: OWNER, appUrl: "x", meta })).rejects.toMatchObject({ code: "not_requestable" });
  });

  it("requires consent and a verified code before signing", async () => {
    const { admin } = setup();
    await requestSignatures(admin, { contractId: C, ownerId: OWNER, appUrl: "https://app.test", meta });
    const token = lastToken();
    let s = await signerFromToken(admin, token);
    await expect(sign(admin, s, { signature: PNG, method: "drawn" }, meta, "x")).rejects.toMatchObject({ code: "consent_required" });
    await recordConsent(admin, s, meta, "Acepto usar firma electrónica");
    s = await signerFromToken(admin, token);
    await expect(sign(admin, s, { signature: PNG, method: "drawn" }, meta, "x")).rejects.toMatchObject({ code: "verification_required" });
  });

  it("locks the code after five wrong attempts", async () => {
    const { admin } = setup();
    await requestSignatures(admin, { contractId: C, ownerId: OWNER, appUrl: "https://app.test", meta });
    const token = lastToken();
    await sendCode(admin, await signerFromToken(admin, token), "sms", meta);
    const sentCode = /(\d{6})/.exec(sent.sms.at(-1)!.body)![1];
    const wrong = sentCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await expect(verifyCode(admin, await signerFromToken(admin, token), wrong, meta)).rejects.toMatchObject({ code: "code_wrong" });
    }
    await expect(verifyCode(admin, await signerFromToken(admin, token), "123456", meta)).rejects.toMatchObject({ code: "code_locked" });
  });

  it("signs in order, refuses changed terms, and seals with every party's copy", async () => {
    const { db, admin, contract } = setup();
    await requestSignatures(admin, { contractId: C, ownerId: OWNER, appUrl: "https://app.test", meta });
    const tenantToken = lastToken();

    // Signs the tenant (code read from the SMS).
    const consentAndVerify = async (token: string) => {
      await recordConsent(admin, await signerFromToken(admin, token), meta, "Acepto usar firma electrónica");
      await sendCode(admin, await signerFromToken(admin, token), "email", meta);
      const code = /(\d{6})/.exec(sent.emails.at(-1)!.subject)![1];
      await verifyCode(admin, await signerFromToken(admin, token), code, meta);
    };
    await consentAndVerify(tenantToken);

    // Terms edited after the request: refuse.
    contract.rent_amount = 999;
    await expect(sign(admin, await signerFromToken(admin, tenantToken), { signature: PNG, method: "drawn" }, meta, "https://app.test")).rejects.toMatchObject({ code: "contract_changed" });
    contract.rent_amount = 1150;

    const sealedEarly = await sign(admin, await signerFromToken(admin, tenantToken), { signature: PNG, method: "drawn" }, meta, "https://app.test");
    expect(sealedEarly).toBe(false);

    // The co-tenant is notified only now (email, since no phone).
    const coEmail = sent.emails.find((e) => e.to === "ana@test");
    expect(coEmail).toBeTruthy();
    const coRow = db.tables.contract_signers.find((r) => r.role === "co_tenant")!;
    // Tokens are only sent, never stored: issue a fresh one for the test.
    const { reissueLink } = await import("@/lib/esign/service");
    const { token: coTok } = await reissueLink(admin, { signerId: coRow.id as string, ownerId: OWNER, appUrl: "https://app.test", inPerson: false, notify: false });
    await consentAndVerify(coTok);
    expect(await sign(admin, await signerFromToken(admin, coTok), { signature: PNG, method: "typed", typedName: "Ana Colón" }, meta, "https://app.test")).toBe(false);

    // Landlord signature completes it.
    contract.landlord_signature = PNG;
    expect(await maybeSeal(admin, C, "https://app.test")).toBe(true);
    expect(contract.status).toBe("signed");
    expect(contract.sealed_pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    const sealed = db.storage.get(`signed-documents/${contract.sealed_pdf_path}`)!;
    expect(sealed.subarray(0, 4).toString()).toBe("%PDF");
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(sealed).digest("hex")).toBe(contract.sealed_pdf_sha256);
    const withPdf = sent.emails.filter((e) => e.attachments?.length);
    expect(withPdf.map((e) => e.to).sort()).toEqual(["ana@test", "jose@test", `${OWNER}@owner.test`].sort());
    const events = db.tables.signature_events.map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(["requested", "sent", "consented", "otp_sent", "otp_verified", "signed", "sealed"]));
  }, 30_000);
});
