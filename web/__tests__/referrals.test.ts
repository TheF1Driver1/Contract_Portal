import { describe, expect, it, vi } from "vitest";
import {
  REFERRAL_ALPHABET,
  REFERRAL_CODE_LENGTH,
  attachDecision,
  generateReferralCode,
  hasReferralCookie,
  insertUniqueCode,
  normalizeReferralCode,
  parseReferralCookie,
  referralDestination,
  referralLink,
  whatsappShareUrl,
} from "@/lib/referrals/code";
import { attachReferral, convertReferral, countReferrals, ensureReferralCode, type RewardStripe } from "@/lib/referrals/service";
import { PartnerApplicationSchema } from "@/lib/schemas";
import { fakeSupabase } from "./helpers/fakeSupabase";

type Admin = Parameters<typeof convertReferral>[0];
const REFERRER = "11111111-1111-4111-8111-111111111111";
const REFERRED = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-08T12:00:00Z");

describe("referral codes", () => {
  it("uses only unambiguous characters", () => {
    for (const ch of "01OIL") expect(REFERRAL_ALPHABET).not.toContain(ch);
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect([...code].every((c) => REFERRAL_ALPHABET.includes(c))).toBe(true);
    }
  });

  it("skips bytes that would bias the alphabet", () => {
    // 248+ is rejected (256 - 256 % 31); 0 maps to the first character.
    const bytes = (n: number) => new Uint8Array(n).fill(0).map((_, i) => (i % 2 ? 0 : 255));
    expect(generateReferralCode(bytes)).toBe(REFERRAL_ALPHABET[0].repeat(REFERRAL_CODE_LENGTH));
  });

  it("retries on a collision and stops on other errors", async () => {
    const seq = ["AAAAAAAA", "BBBBBBBB", "CCCCCCCC"];
    const gen = () => seq.shift()!;
    const taken = new Set(["AAAAAAAA", "BBBBBBBB"]);
    const tryInsert = vi.fn(async (c: string) => (taken.has(c) ? ("collision" as const) : ("ok" as const)));
    expect(await insertUniqueCode(tryInsert, gen)).toBe("CCCCCCCC");
    expect(tryInsert).toHaveBeenCalledTimes(3);

    const failing = vi.fn(async () => "error" as const);
    expect(await insertUniqueCode(failing, () => "DDDDDDDD")).toBeNull();
    expect(failing).toHaveBeenCalledTimes(1);

    const always = vi.fn(async () => "collision" as const);
    expect(await insertUniqueCode(always, () => "EEEEEEEE", 4)).toBeNull();
    expect(always).toHaveBeenCalledTimes(4);
  });

  it("normalizes what people type and rejects the rest", () => {
    expect(normalizeReferralCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeReferralCode("ABCDEFG0")).toBeNull(); // 0 is not in the alphabet
    expect(normalizeReferralCode("ABC")).toBeNull();
    expect(normalizeReferralCode("<script>")).toBeNull();
    expect(parseReferralCookie(undefined)).toBeNull();
    expect(parseReferralCookie("XYZ23456")).toBe("XYZ23456");
  });

  it("detects the cookie and builds share links", () => {
    expect(hasReferralCookie("NEXT_LOCALE=es; cos_ref=ABCDEFGH")).toBe(true);
    expect(hasReferralCookie("xcos_ref=ABCDEFGH")).toBe(false);
    expect(referralLink("https://prcontract.online/", "ABCDEFGH")).toBe("https://prcontract.online/r/ABCDEFGH");
    expect(whatsappShareUrl("Hola & bienvenido")).toBe("https://wa.me/?text=Hola%20%26%20bienvenido");
    expect(referralDestination(null)).toBe("/signup");
    expect(referralDestination("pricing")).toBe("/pricing");
    expect(referralDestination("https://evil.example")).toBe("/signup");
  });
});

describe("attachDecision", () => {
  const base = { code: "ABCDEFGH", referrerId: REFERRER, userId: REFERRED, userCreatedAt: "2026-10-08T11:00:00Z", now: NOW };

  it("attaches a new landlord account", () => {
    expect(attachDecision(base)).toEqual({ attach: true });
    expect(attachDecision({ ...base, role: "landlord" })).toEqual({ attach: true });
  });

  it("ignores self-referrals, unknown codes, old accounts and tenants", () => {
    expect(attachDecision({ ...base, referrerId: REFERRED })).toEqual({ attach: false, reason: "self_referral" });
    expect(attachDecision({ ...base, referrerId: null })).toEqual({ attach: false, reason: "unknown_code" });
    expect(attachDecision({ ...base, code: null })).toEqual({ attach: false, reason: "no_code" });
    expect(attachDecision({ ...base, userCreatedAt: "2026-09-01T00:00:00Z" })).toEqual({ attach: false, reason: "existing_account" });
    expect(attachDecision({ ...base, userCreatedAt: null })).toEqual({ attach: false, reason: "existing_account" });
    expect(attachDecision({ ...base, role: "tenant" })).toEqual({ attach: false, reason: "not_landlord" });
  });
});

describe("referral service", () => {
  it("creates a code once and reuses it", async () => {
    const f = fakeSupabase({ referral_codes: [] });
    const admin = f.client as unknown as Admin;
    const code = await ensureReferralCode(admin, REFERRER, () => "QRSTUVWX");
    expect(code).toBe("QRSTUVWX");
    expect(await ensureReferralCode(admin, REFERRER, () => "ZZZZZZZZ")).toBe("QRSTUVWX");
    expect(f.tables.referral_codes).toHaveLength(1);
  });

  it("records a referred signup once and never a self-referral", async () => {
    const f = fakeSupabase({
      referral_codes: [{ owner_id: REFERRER, code: "ABCDEFGH" }],
      profiles: [{ id: REFERRED, role: "landlord" }, { id: REFERRER, role: "landlord" }],
      referrals: [],
    });
    const admin = f.client as unknown as Admin;
    const created = "2026-10-08T11:59:00Z";
    expect(await attachReferral(admin, { code: "ABCDEFGH", userId: REFERRER, userCreatedAt: created, now: NOW })).toEqual({
      attach: false,
      reason: "self_referral",
    });
    expect(await attachReferral(admin, { code: "ABCDEFGH", userId: REFERRED, userCreatedAt: created, now: NOW })).toEqual({ attach: true });
    expect(f.tables.referrals).toMatchObject([{ referrer_id: REFERRER, referred_user_id: REFERRED, status: "signed_up" }]);
  });

  function setup(sub: Record<string, unknown> | null) {
    const f = fakeSupabase({
      referrals: [{ id: "ref-1", referrer_id: REFERRER, referred_user_id: REFERRED, code: "ABCDEFGH", status: "signed_up", converted_at: null, reward_reference: null }],
      subscriptions: sub ? [{ owner_id: REFERRER, ...sub }] : [],
    });
    const update = vi.fn(async () => ({}));
    const stripe: RewardStripe = {
      subscriptions: { retrieve: vi.fn(async () => ({ status: "active", discounts: [] })), update },
    };
    return { f, admin: f.client as unknown as Admin, stripe, update };
  }

  it("converts and rewards once, even when Stripe delivers several paid events", async () => {
    const { f, admin, stripe, update } = setup({ stripe_subscription_id: "sub_ref", status: "active" });
    const first = await convertReferral(admin, REFERRED, { stripe, couponId: "coupon_month", now: NOW });
    expect(first).toEqual({ converted: true, rewarded: true, reference: "sub_ref:coupon_month" });
    expect(update).toHaveBeenCalledWith("sub_ref", { discounts: [{ coupon: "coupon_month" }] }, { idempotencyKey: "referral-reward-ref-1" });

    // Retried event / a later invoice: nothing happens again.
    expect(await convertReferral(admin, REFERRED, { stripe, couponId: "coupon_month", now: NOW })).toEqual({ converted: false });
    expect(update).toHaveBeenCalledTimes(1);
    expect(f.tables.referrals[0]).toMatchObject({ status: "rewarded", converted_at: NOW.toISOString(), reward_reference: "sub_ref:coupon_month" });
  });

  it("leaves the referral converted for a manual reward without a coupon or subscription", async () => {
    let s = setup({ stripe_subscription_id: "sub_ref", status: "active" });
    expect(await convertReferral(s.admin, REFERRED, { stripe: s.stripe, couponId: undefined })).toEqual({
      converted: true,
      rewarded: false,
      reason: "no_coupon",
    });
    expect(s.update).not.toHaveBeenCalled();
    expect(s.f.tables.referrals[0].status).toBe("converted");

    s = setup(null);
    expect(await convertReferral(s.admin, REFERRED, { stripe: s.stripe, couponId: "coupon_month" })).toMatchObject({
      rewarded: false,
      reason: "no_referrer_subscription",
    });

    s = setup({ stripe_subscription_id: "sub_ref", status: "canceled" });
    expect(await convertReferral(s.admin, REFERRED, { stripe: s.stripe, couponId: "coupon_month" })).toMatchObject({
      reason: "no_referrer_subscription",
    });
    expect(s.update).not.toHaveBeenCalled();
  });

  it("never replaces a discount the referrer already has, and survives Stripe errors", async () => {
    let s = setup({ stripe_subscription_id: "sub_ref", status: "active" });
    s.stripe.subscriptions.retrieve = vi.fn(async () => ({ status: "active", discounts: ["di_existing"] }));
    expect(await convertReferral(s.admin, REFERRED, { stripe: s.stripe, couponId: "coupon_month" })).toMatchObject({
      reason: "existing_discount",
    });
    expect(s.update).not.toHaveBeenCalled();

    s = setup({ stripe_subscription_id: "sub_ref", status: "trialing" });
    s.stripe.subscriptions.update = vi.fn(async () => {
      throw new Error("No such coupon");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await convertReferral(s.admin, REFERRED, { stripe: s.stripe, couponId: "coupon_missing" })).toMatchObject({
      reason: "stripe_error",
    });
    spy.mockRestore();
    expect(s.f.tables.referrals[0].status).toBe("converted");
  });

  it("does nothing for users who were not referred", async () => {
    const { admin, stripe, update } = setup({ stripe_subscription_id: "sub_ref", status: "active" });
    expect(await convertReferral(admin, "33333333-3333-4333-8333-333333333333", { stripe, couponId: "c" })).toEqual({ converted: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("counts rewarded referrals as converted", () => {
    expect(countReferrals([{ status: "signed_up" }, { status: "converted" }, { status: "rewarded" }])).toEqual({ signedUp: 3, converted: 2 });
  });
});

describe("PartnerApplicationSchema", () => {
  const ok = { name: "Ana Torres", email: "ana@example.com", kind: "realtor" };

  it("accepts a minimal application and fills defaults", () => {
    const r = PartnerApplicationSchema.parse(ok);
    expect(r).toMatchObject({ phone: "", company: "", message: "", locale: "es", website: "" });
    expect(PartnerApplicationSchema.parse({ ...ok, clients: "25", locale: "en" })).toMatchObject({ clients: 25, locale: "en" });
  });

  it("rejects bad input and a filled honeypot", () => {
    expect(PartnerApplicationSchema.safeParse({ ...ok, kind: "lawyer" }).success).toBe(false);
    expect(PartnerApplicationSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(PartnerApplicationSchema.safeParse({ ...ok, name: "A" }).success).toBe(false);
    expect(PartnerApplicationSchema.safeParse({ ...ok, phone: "<b>787</b>" }).success).toBe(false);
    expect(PartnerApplicationSchema.safeParse({ ...ok, clients: -1 }).success).toBe(false);
    expect(PartnerApplicationSchema.safeParse({ ...ok, website: "http://spam" }).success).toBe(false);
  });
});

describe("/r/<code>", () => {
  it("remembers a valid code for 60 days and sends the visitor to signup", async () => {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/r/[code]/route");
    const res = await GET(new NextRequest("https://prcontract.online/r/abcd-efgh"), { params: Promise.resolve({ code: "abcd-efgh" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://prcontract.online/signup");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("cos_ref=ABCDEFGH");
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 60}`);
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("ignores a malformed code but still redirects (to pricing when asked)", async () => {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/r/[code]/route");
    const res = await GET(new NextRequest("https://prcontract.online/r/x?to=pricing"), { params: Promise.resolve({ code: "x" }) });
    expect(res.headers.get("location")).toBe("https://prcontract.online/pricing");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
