import type Stripe from "stripe";
import type { SubscriptionPlan } from "@/lib/types";

export async function getStripe(): Promise<Stripe> {
  const StripeCtor = (await import("stripe")).default;
  return new StripeCtor(process.env.STRIPE_SECRET_KEY ?? "");
}

export const PAID_PLAN_PRICES: Partial<Record<SubscriptionPlan, string | undefined>> = {
  propietario: process.env.STRIPE_PRICE_PROPIETARIO,
  inversionista: process.env.STRIPE_PRICE_INVERSIONISTA,
};

const YEARLY_PRICES: Partial<Record<SubscriptionPlan, string | undefined>> = {
  propietario: process.env.STRIPE_PRICE_PROPIETARIO_YEARLY,
  inversionista: process.env.STRIPE_PRICE_INVERSIONISTA_YEARLY,
};

export type BillingInterval = "month" | "year";

/** Stripe price for a plan; yearly falls back to monthly when not configured. */
export function priceFor(plan: string, interval: BillingInterval): string | undefined {
  const p = plan as SubscriptionPlan;
  return (interval === "year" ? YEARLY_PRICES[p] : undefined) || PAID_PLAN_PRICES[p] || undefined;
}

/** What checkout can offer, for the billing page. */
export function billingOptions(): { yearly: boolean; trialDays: number } {
  return { yearly: Object.values(YEARLY_PRICES).some(Boolean), trialDays: trialDays() };
}

/** Free trial on a first paid subscription (STRIPE_TRIAL_DAYS, 0 = none). */
export function trialDays(): number {
  const n = Number.parseInt(process.env.STRIPE_TRIAL_DAYS ?? "0", 10);
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : 0;
}

export function planForPrice(priceId: string): SubscriptionPlan {
  const map: Record<string, SubscriptionPlan> = {};
  if (process.env.STRIPE_PRICE_PROPIETARIO) map[process.env.STRIPE_PRICE_PROPIETARIO] = "propietario";
  if (process.env.STRIPE_PRICE_INVERSIONISTA) map[process.env.STRIPE_PRICE_INVERSIONISTA] = "inversionista";
  if (process.env.STRIPE_PRICE_ENTERPRISE) map[process.env.STRIPE_PRICE_ENTERPRISE] = "enterprise";
  // Optional yearly prices (Plan 37)
  if (process.env.STRIPE_PRICE_PROPIETARIO_YEARLY) map[process.env.STRIPE_PRICE_PROPIETARIO_YEARLY] = "propietario";
  if (process.env.STRIPE_PRICE_INVERSIONISTA_YEARLY) map[process.env.STRIPE_PRICE_INVERSIONISTA_YEARLY] = "inversionista";
  return map[priceId] ?? "free";
}

/**
 * Which plan a subscription in this Stripe status should grant.
 * past_due keeps access during Stripe's retry window; unpaid, canceled and
 * incomplete_expired drop to free.
 */
export function effectivePlan(status: string, pricedPlan: SubscriptionPlan): SubscriptionPlan {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return pricedPlan;
    default:
      return "free";
  }
}

/** Maps Stripe statuses onto the subscriptions.status check constraint. */
export function storedStatus(status: string): "active" | "past_due" | "canceled" | "trialing" {
  if (status === "trialing" || status === "past_due" || status === "active") return status;
  if (status === "unpaid") return "past_due";
  return "canceled";
}
