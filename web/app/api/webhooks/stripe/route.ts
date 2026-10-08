import { trackEvent } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import {
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/emails/subscription";
import { effectivePlan, getStripe, planForPrice, storedStatus } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

type Admin = ReturnType<typeof createAdminClient>;

// Email failures must never fail the webhook — Stripe would retry the whole event
async function notifyOwner(admin: Admin, ownerId: string, send: (email: string) => Promise<void>) {
  try {
    const { data } = await admin.auth.admin.getUserById(ownerId);
    const email = data?.user?.email;
    if (email) await send(email);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "stripe-webhook email failed", err: String(err) }));
  }
}

/** Returns true when this event id was already processed (Stripe retries deliveries). */
async function alreadyProcessed(admin: Admin, id: string, type: string): Promise<boolean> {
  const { error } = await admin.from("stripe_events").insert({ id, type });
  if (!error) return false;
  if (error.code === "23505") return true; // duplicate id
  // Table missing (migration 013 not applied yet) or transient error: process anyway.
  return false;
}

type SubLike = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
  metadata?: { owner_id?: string };
};

async function ownerFor(admin: Admin, sub: { customer?: string; metadata?: { owner_id?: string } }) {
  if (sub.metadata?.owner_id) return sub.metadata.owner_id;
  if (!sub.customer) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_customer_id", sub.customer)
    .maybeSingle();
  return data?.owner_id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const stripe = await getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (await alreadyProcessed(admin, event.id, event.type)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as unknown as SubLike;
    const ownerId = await ownerFor(admin, sub);
    if (!ownerId) return NextResponse.json({ received: true });

    const item = sub.items?.data?.[0];
    const pricedPlan = planForPrice(item?.price?.id ?? "");
    const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
    const plan = effectivePlan(status, pricedPlan);
    // API versions 2025-03-31+ moved current_period_end onto the subscription item
    const periodEnd = item?.current_period_end ?? sub.current_period_end;

    const { data: existing } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("owner_id", ownerId)
      .maybeSingle();

    await admin.from("subscriptions").upsert(
      {
        owner_id: ownerId,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        plan,
        status: storedStatus(status),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );
    await admin.from("profiles").update({ plan }).eq("id", ownerId);

    if (plan !== "free" && existing?.plan !== plan) {
      await trackEvent("subscribed", { plan });
      await notifyOwner(admin, ownerId, (email) => sendSubscriptionActivatedEmail(email, plan, APP_URL));
    } else if (plan === "free" && existing?.plan && existing.plan !== "free") {
      await notifyOwner(admin, ownerId, (email) => sendSubscriptionCancelledEmail(email, APP_URL));
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as unknown as { customer?: string };
    const ownerId = await ownerFor(admin, { customer: invoice.customer });
    if (ownerId) {
      await admin.from("subscriptions").update({ status: "past_due" }).eq("owner_id", ownerId);
      await notifyOwner(admin, ownerId, (email) => sendPaymentFailedEmail(email, APP_URL));
    }
  }

  return NextResponse.json({ received: true });
}
