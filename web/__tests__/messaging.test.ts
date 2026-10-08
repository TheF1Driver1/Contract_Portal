// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
import { fakeSupabase } from "./helpers/fakeSupabase";

const sent = { emails: [] as { to: string; subject: string }[], sms: [] as { to: string; body: string }[], fail: false };
vi.mock("@/lib/notify", () => ({
  sendResendEmail: async (to: string, subject: string) => {
    if (sent.fail) throw new Error("provider down");
    sent.emails.push({ to, subject });
    return `re_${sent.emails.length}`;
  },
  sendTwilioSms: async (to: string, body: string) => {
    sent.sms.push({ to, body });
    return `SM${sent.sms.length}`;
  },
  sendTwilioWhatsApp: async () => ({ sid: "SMwa", status: "queued" }),
  twilioStatusCallback: () => undefined,
}));

import { advanceStatus, fromResendEvent, fromTwilioStatus, normalizePhone, parseKeyword } from "@/lib/messaging/inbound";
import { svixSignature, twilioSignature, verifySvixSignature, verifyTwilioSignature } from "@/lib/messaging/signatures";
import { pickTenantChannel, rentNotices } from "@/lib/messaging/rent-notices";
import { renderMessage, whatsappTemplate } from "@/lib/messaging/templates";
import { sendMessage } from "@/lib/messaging/send";
import { applyStatus } from "@/lib/messaging/webhooks";
import type { Charge } from "@/lib/rent/schedule";

describe("phone numbers", () => {
  it("normalizes PR/US numbers to E.164", () => {
    expect(normalizePhone("(787) 555-0101")).toBe("+17875550101");
    expect(normalizePhone("787.555.0101")).toBe("+17875550101");
    expect(normalizePhone("1-939-555-0101")).toBe("+19395550101");
    expect(normalizePhone("whatsapp:+17875550101")).toBe("+17875550101");
    expect(normalizePhone("+34 600 123 456")).toBe("+34600123456");
    expect(normalizePhone("555-0101")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("keywords", () => {
  it("recognizes opt-out words in English and Spanish", () => {
    for (const w of ["STOP", "stop", " Stop. ", "STOPALL", "unsubscribe", "Cancel", "END", "quit", "PARAR", "baja", "Baja!"]) {
      expect(parseKeyword(w)).toBe("stop");
    }
  });
  it("recognizes opt-in and help", () => {
    expect(parseKeyword("START")).toBe("start");
    expect(parseKeyword("unstop")).toBe("start");
    expect(parseKeyword("Alta")).toBe("start");
    expect(parseKeyword("HELP")).toBe("help");
    expect(parseKeyword("ayuda")).toBe("help");
    expect(parseKeyword("Ayúda")).toBe("help");
  });
  it("ignores keywords inside a normal message", () => {
    expect(parseKeyword("no puedo parar de reír")).toBeNull();
    expect(parseKeyword("Please stop by tomorrow")).toBeNull();
    expect(parseKeyword("Ya pagué la renta")).toBeNull();
    expect(parseKeyword(undefined)).toBeNull();
  });
});

describe("Twilio signature", () => {
  const token = "test_auth_token";
  const url = "https://app.test/api/webhooks/twilio/inbound";
  const params = { From: "+17875550101", To: "+17875550100", Body: "STOP", MessageSid: "SM123" };

  it("matches Twilio's own validator", () => {
    const sig = twilioSignature(token, url, params);
    expect(twilio.validateRequest(token, sig, url, params)).toBe(true);
  });
  it("accepts a valid signature on any candidate URL and rejects tampering", () => {
    const sig = twilioSignature(token, url, params);
    expect(verifyTwilioSignature({ authToken: token, signature: sig, urls: ["http://internal/x", url], params })).toBe(true);
    expect(verifyTwilioSignature({ authToken: token, signature: sig, urls: [url], params: { ...params, Body: "START" } })).toBe(false);
    expect(verifyTwilioSignature({ authToken: "other", signature: sig, urls: [url], params })).toBe(false);
    expect(verifyTwilioSignature({ authToken: undefined, signature: sig, urls: [url], params })).toBe(false);
    expect(verifyTwilioSignature({ authToken: token, signature: null, urls: [url], params })).toBe(false);
  });
});

describe("Svix (Resend) signature", () => {
  const secret = "whsec_" + Buffer.from("super-secret-key-for-tests").toString("base64");
  const body = JSON.stringify({ type: "email.opened", data: { email_id: "re_1" } });
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);

  it("verifies v1 signatures, including one of several", () => {
    const sig = svixSignature(secret, "msg_1", ts, body);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,${sig}`, body, now })).toBe(true);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,bogus v1,${sig}`, body, now })).toBe(true);
  });
  it("rejects a changed body, wrong id, old timestamp or missing secret", () => {
    const sig = svixSignature(secret, "msg_1", ts, body);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,${sig}`, body: body + " ", now })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_2", timestamp: ts, signature: `v1,${sig}`, body, now })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,${sig}`, body, now: now + 10 * 60_000 })).toBe(false);
    expect(verifySvixSignature({ secret: undefined, id: "msg_1", timestamp: ts, signature: `v1,${sig}`, body, now })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v2,${sig}`, body, now })).toBe(false);
  });
});

describe("delivery status", () => {
  it("maps provider statuses", () => {
    expect(fromTwilioStatus("undelivered")).toBe("failed");
    expect(fromTwilioStatus("read")).toBe("read");
    expect(fromTwilioStatus("weird")).toBeNull();
    expect(fromResendEvent("email.bounced")).toBe("failed");
    expect(fromResendEvent("email.opened")).toBe("read");
    expect(fromResendEvent("email.delivery_delayed")).toBeNull();
  });
  it("only moves forward", () => {
    expect(advanceStatus("sent", "delivered")).toBe("delivered");
    expect(advanceStatus("delivered", "sent")).toBeNull();
    expect(advanceStatus("sent", "failed")).toBe("failed");
    expect(advanceStatus("delivered", "failed")).toBeNull();
    expect(advanceStatus("read", "delivered")).toBeNull();
    expect(advanceStatus("skipped", "sent")).toBeNull();
  });
});

describe("rent notices", () => {
  const rent = (period: string, amount = 1000): Charge => ({ kind: "rent", period, due_date: period, amount });
  const charges = [rent("2026-09-01"), rent("2026-10-01")];
  const paidSept = [{ amount: 1000, received_on: "2026-09-02" }];

  it("reminds up to 3 days before an unpaid due date", () => {
    expect(rentNotices(charges, paidSept, "2026-09-28", 5)).toEqual([{ kind: "reminder", period: "2026-10-01", dueDate: "2026-10-01", amount: 1000 }]);
    expect(rentNotices(charges, paidSept, "2026-09-30", 5).map((n) => n.kind)).toEqual(["reminder"]);
    expect(rentNotices(charges, paidSept, "2026-09-27", 5)).toEqual([]);
    expect(rentNotices(charges, paidSept, "2026-10-01", 5)).toEqual([]); // due today: no reminder, not late yet
  });
  it("skips months already covered", () => {
    expect(rentNotices(charges, [...paidSept, { amount: 1000, received_on: "2026-09-27" }], "2026-09-29", 5)).toEqual([]);
  });
  it("sends the overdue notice after grace ends, with the past-due balance", () => {
    const withFee = [...charges, { kind: "late_fee" as const, period: "2026-10-01", due_date: "2026-10-07", amount: 50 }];
    expect(rentNotices(withFee, paidSept, "2026-10-06", 5)).toEqual([]);
    expect(rentNotices(withFee, paidSept, "2026-10-07", 5)).toEqual([{ kind: "overdue", period: "2026-10-01", dueDate: "2026-10-01", amount: 1000 }]);
    expect(rentNotices(withFee, paidSept, "2026-10-08", 5)[0].amount).toBe(1050);
    expect(rentNotices(withFee, paidSept, "2026-10-12", 5)).toEqual([]);
  });
});

describe("channel choice", () => {
  const consents = [
    { channel: "whatsapp" as const, status: "opted_in" as const, address: "+17875550101" },
    { channel: "sms" as const, status: "opted_in" as const, address: "+17875550101" },
  ];
  it("prefers WhatsApp, then SMS (paid plans), then email", () => {
    expect(pickTenantChannel({ consents, email: "a@b.co", smsAllowed: true, whatsappReady: true })?.channel).toBe("whatsapp");
    expect(pickTenantChannel({ consents, email: "a@b.co", smsAllowed: true, whatsappReady: false })?.channel).toBe("sms");
    expect(pickTenantChannel({ consents, email: "a@b.co", smsAllowed: false, whatsappReady: false })).toEqual({ channel: "email", to: "a@b.co" });
    expect(pickTenantChannel({ consents: [{ ...consents[1], status: "opted_out" }], email: null, smsAllowed: true, whatsappReady: false })).toBeNull();
  });
});

describe("templates", () => {
  it("renders in the recipient's language", () => {
    const vars = { name: "Ana", amount: "$1,150", date: "1 de octubre de 2026", property: "Las Palmas 2B", landlord: "María" };
    const es = renderMessage("rent_reminder", "es", vars);
    expect(es.subject).toBe("Tu renta de $1,150 vence el 1 de octubre de 2026");
    expect(es.html).toContain('lang="es"');
    expect(es.text).toMatch(/^ContractOS: Hola Ana/);
    expect(renderMessage("rent_overdue", "en", vars).subject).toBe("Rent past due: Las Palmas 2B");
  });
  it("lists digest items and escapes them", () => {
    const d = renderMessage("landlord_digest", "es", {
      overdue: [{ who: "José <b>", amount: "$1,200" }],
      payments: [],
      pending: [{ who: "Ana · Casa" }],
      url: "https://app.test/dashboard",
    });
    expect(d.subject).toBe("Tu resumen de ContractOS: 2 asuntos");
    expect(d.html).toContain("José &lt;b&gt;: $1,200");
    expect(d.html).not.toContain("Pagos registrados");
  });
  it("maps WhatsApp templates from env", () => {
    const env = { TWILIO_WHATSAPP_FROM: "+17875550100", TWILIO_WA_TEMPLATE_RENT_REMINDER_EN: "HX1" };
    expect(whatsappTemplate("rent_reminder", "en", { name: "Ana", amount: "$5", date: "Oct 1", property: "P" }, env)).toEqual({
      contentSid: "HX1",
      variables: { "1": "Ana", "2": "$5", "3": "Oct 1", "4": "P" },
    });
    expect(whatsappTemplate("rent_reminder", "es", {}, env)).toBeNull();
    expect(whatsappTemplate("landlord_digest", "en", {}, env)).toBeNull();
  });
});

describe("sendMessage", () => {
  const OWNER = "11111111-1111-4111-8111-111111111111";
  const TENANT = "22222222-2222-4222-8222-222222222222";
  beforeEach(() => {
    sent.emails = [];
    sent.sms = [];
    sent.fail = false;
    process.env.TWILIO_ACCOUNT_SID = "AC";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+17875550100";
  });

  function db(consents: Record<string, unknown>[] = []) {
    const f = fakeSupabase({ message_log: [], messaging_consents: consents });
    // Emulate the unique idempotency_key index.
    const from = f.client.from;
    f.client.from = ((table: string) => {
      const q = from(table) as Record<string, (...a: unknown[]) => unknown>;
      if (table !== "message_log") return q;
      const insert = q.insert;
      q.insert = (...args: unknown[]) => {
        const p = args[0] as Record<string, unknown>;
        if (p.idempotency_key && f.tables.message_log.some((r) => r.idempotency_key === p.idempotency_key)) {
          return { select: () => ({ maybeSingle: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }) }) };
        }
        return insert(p);
      };
      return q;
    }) as typeof from;
    return f;
  }

  const base = {
    template: "rent_reminder" as const,
    locale: "es",
    vars: { name: "Ana", amount: "$1,150", date: "1 de octubre", property: "Las Palmas", landlord: "María" },
    ownerId: OWNER,
    recipient: { kind: "tenant" as const, id: TENANT },
  };

  it("logs, sends once and returns duplicate on repeat", async () => {
    const f = db();
    const client = f.client as never;
    const r1 = await sendMessage({ ...base, db: client, channel: "email", to: "Ana@Example.com", idempotencyKey: "rent:c:2026-10-01:reminder" });
    expect(r1).toMatchObject({ status: "sent", providerId: "re_1" });
    const r2 = await sendMessage({ ...base, db: client, channel: "email", to: "ana@example.com", idempotencyKey: "rent:c:2026-10-01:reminder" });
    expect(r2.skipped).toBe("duplicate");
    expect(sent.emails).toHaveLength(1);
    expect(f.tables.message_log).toHaveLength(1);
    expect(f.tables.message_log[0]).toMatchObject({ status: "sent", provider: "resend", provider_id: "re_1", to_address: "ana@example.com" });
  });

  it("retries a failed send with the same key", async () => {
    const f = db();
    const client = f.client as never;
    sent.fail = true;
    const r1 = await sendMessage({ ...base, db: client, channel: "email", to: "ana@example.com", idempotencyKey: "k" });
    expect(r1).toMatchObject({ status: "failed", error: "provider down" });
    sent.fail = false;
    const r2 = await sendMessage({ ...base, db: client, channel: "email", to: "ana@example.com", idempotencyKey: "k" });
    expect(r2.status).toBe("sent");
    expect(f.tables.message_log).toHaveLength(1);
  });

  it("does not text without consent, and honors STOP", async () => {
    const f = db([{ owner_id: OWNER, subject_kind: "tenant", subject_id: TENANT, channel: "sms", address: "+17875550101", status: "opted_out", source: "inbound_stop" }]);
    const r = await sendMessage({ ...base, db: f.client as never, channel: "sms", to: "787-555-0101", idempotencyKey: "s1" });
    expect(r).toMatchObject({ status: "skipped", skipped: "no_consent" });
    expect(sent.sms).toHaveLength(0);
    // Skips don't consume the key.
    expect(f.tables.message_log[0].idempotency_key).toBeUndefined();
  });

  it("texts when the tenant opted in", async () => {
    const f = db([{ owner_id: OWNER, subject_kind: "tenant", subject_id: TENANT, channel: "sms", address: "+17875550101", status: "opted_in", source: "landlord_attested" }]);
    const r = await sendMessage({ ...base, db: f.client as never, channel: "sms", to: "(787) 555-0101", idempotencyKey: "s2" });
    expect(r).toMatchObject({ status: "sent", providerId: "SM1" });
    expect(sent.sms[0]).toEqual({ to: "+17875550101", body: expect.stringContaining("Hola Ana") });
  });

  it("skips WhatsApp when no template is configured", async () => {
    const f = db([{ owner_id: OWNER, subject_kind: "tenant", subject_id: TENANT, channel: "whatsapp", address: "+17875550101", status: "opted_in", source: "landlord_attested" }]);
    const r = await sendMessage({ ...base, db: f.client as never, channel: "whatsapp", to: "+17875550101", idempotencyKey: "w1" });
    expect(r).toMatchObject({ status: "skipped", skipped: "whatsapp_not_configured" });
  });
});

describe("status webhook effects", () => {
  it("advances status and stamps opened_at on contract emails", async () => {
    const C = "33333333-3333-4333-8333-333333333333";
    const f = fakeSupabase({
      message_log: [{ id: "m1", direction: "outbound", provider_id: "re_9", status: "sent", contract_id: C, template: "contract_ready_to_sign" }],
      contracts: [{ id: C, opened_at: null }],
    });
    expect(await applyStatus(f.client as never, "re_9", "delivered")).toBe("delivered");
    expect(await applyStatus(f.client as never, "re_9", "read")).toBe("read");
    expect(f.tables.message_log[0]).toMatchObject({ status: "read" });
    expect(f.tables.contracts[0].opened_at).toBeTruthy();
    expect(await applyStatus(f.client as never, "re_9", "sent")).toBeNull();
    expect(await applyStatus(f.client as never, "unknown", "sent")).toBeNull();
  });
});
