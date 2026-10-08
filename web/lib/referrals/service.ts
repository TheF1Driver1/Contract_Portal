// Referral program (Plan 37): codes, signup attribution and conversion rewards.
// Every write here runs with the service role; callers verify who the user is.
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { attachDecision, insertUniqueCode, type AttachDecision } from "@/lib/referrals/code";

type Client = SupabaseClient<Database>;

/** The slice of the Stripe SDK the reward needs (typed against stripe@22). */
export type RewardStripe = {
  subscriptions: {
    retrieve(id: string): Promise<{ status: string; discounts?: unknown[] | null }>;
    update(id: string, params: Stripe.SubscriptionUpdateParams, options?: Stripe.RequestOptions): Promise<unknown>;
  };
};

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.error(JSON.stringify({ level: "error", msg, ...extra }));

/** Returns the owner's code, creating one on first use. */
export async function ensureReferralCode(admin: Client, ownerId: string, generate?: () => string): Promise<string | null> {
  const { data: existing } = await admin.from("referral_codes").select("code").eq("owner_id", ownerId).maybeSingle();
  if (existing?.code) return existing.code;

  let raced = false;
  const code = await insertUniqueCode(
    async (candidate) => {
      const { error } = await admin.from("referral_codes").insert({ owner_id: ownerId, code: candidate });
      if (!error) return "ok";
      if (error.code === "23505") {
        // Unique on owner_id means a parallel request already created this owner's code.
        if (/owner_id|pkey/.test(error.message ?? "")) {
          raced = true;
          return "error";
        }
        return "collision";
      }
      log("referral code insert failed", { err: error.message });
      return "error";
    },
    generate
  );
  if (code) return code;
  if (raced) {
    const { data } = await admin.from("referral_codes").select("code").eq("owner_id", ownerId).maybeSingle();
    return data?.code ?? null;
  }
  return null;
}

/** Records that `user` signed up through `code`. Safe to call more than once. */
export async function attachReferral(
  admin: Client,
  input: { code: string | null; userId: string; userCreatedAt: string | null | undefined; now?: Date }
): Promise<AttachDecision> {
  if (!input.code) return { attach: false, reason: "no_code" };
  const [{ data: owner }, { data: profile }] = await Promise.all([
    admin.from("referral_codes").select("owner_id").eq("code", input.code).maybeSingle(),
    admin.from("profiles").select("role").eq("id", input.userId).maybeSingle(),
  ]);
  const decision = attachDecision({
    code: input.code,
    referrerId: owner?.owner_id ?? null,
    userId: input.userId,
    userCreatedAt: input.userCreatedAt,
    role: profile?.role ?? null,
    now: input.now,
  });
  if (!decision.attach) return decision;

  const { error } = await admin
    .from("referrals")
    .insert({ referrer_id: owner!.owner_id, referred_user_id: input.userId, code: input.code, status: "signed_up" });
  // 23505: this user was already attributed (first referral wins).
  if (error && error.code !== "23505") log("referral attach failed", { err: error.message });
  return decision;
}

export type ConversionResult =
  | { converted: false }
  | { converted: true; rewarded: true; reference: string }
  | { converted: true; rewarded: false; reason: "no_coupon" | "no_referrer_subscription" | "existing_discount" | "stripe_error" };

/**
 * Marks the referred user's referral converted (first paid invoice) and, when
 * STRIPE_REFERRAL_COUPON_ID is set and the referrer has a live subscription,
 * puts that coupon on it. Idempotent: only a `signed_up` row converts, so a
 * retried or second paid event does nothing. Anything not rewarded stays
 * `converted` for a manual credit.
 */
export async function convertReferral(
  admin: Client,
  referredUserId: string,
  opts: { stripe: RewardStripe | null; couponId: string | null | undefined; now?: Date }
): Promise<ConversionResult> {
  const { data: rows, error } = await admin
    .from("referrals")
    .update({ status: "converted", converted_at: (opts.now ?? new Date()).toISOString() })
    .eq("referred_user_id", referredUserId)
    .eq("status", "signed_up")
    .select("id, referrer_id");
  if (error) {
    log("referral convert failed", { err: error.message });
    return { converted: false };
  }
  const referral = rows?.[0];
  if (!referral) return { converted: false };

  if (!opts.couponId || !opts.stripe) return { converted: true, rewarded: false, reason: "no_coupon" };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("owner_id", referral.referrer_id)
    .maybeSingle();
  if (!sub?.stripe_subscription_id || !["active", "trialing"].includes(sub.status ?? "")) {
    return { converted: true, rewarded: false, reason: "no_referrer_subscription" };
  }

  try {
    const current = await opts.stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    if (!["active", "trialing"].includes(current.status)) return { converted: true, rewarded: false, reason: "no_referrer_subscription" };
    // Setting `discounts` replaces what is there; never wipe a discount the referrer already has.
    if (current.discounts?.length) return { converted: true, rewarded: false, reason: "existing_discount" };
    await opts.stripe.subscriptions.update(
      sub.stripe_subscription_id,
      { discounts: [{ coupon: opts.couponId }] },
      { idempotencyKey: `referral-reward-${referral.id}` }
    );
  } catch (err) {
    log("referral reward failed", { referral: referral.id, err: String(err) });
    return { converted: true, rewarded: false, reason: "stripe_error" };
  }

  const reference = `${sub.stripe_subscription_id}:${opts.couponId}`;
  await admin.from("referrals").update({ status: "rewarded", reward_reference: reference }).eq("id", referral.id).eq("status", "converted");
  return { converted: true, rewarded: true, reference };
}

export type ReferralStats = { signedUp: number; converted: number };

/** Counts for the billing card. `converted` includes rewarded referrals. */
export function countReferrals(rows: { status: string }[]): ReferralStats {
  return {
    signedUp: rows.length,
    converted: rows.filter((r) => r.status === "converted" || r.status === "rewarded").length,
  };
}
