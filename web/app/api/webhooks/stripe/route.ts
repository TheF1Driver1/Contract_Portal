import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/emails/subscription";
import type { SubscriptionPlan } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";

// Email failures must never fail the webhook — Stripe would retry the whole event
async function notifyOwner(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
  send: (email: string) => Promise<void>
): Promise<void> {
  try {
    const { data } = await supabase.auth.admin.getUserById(ownerId);
    const email = data?.user?.email;
    if (email) await send(email);
  } catch (err) {
    console.error("[stripe-webhook] subscription email failed:", err);
  }
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function mapStripePlanToPlan(priceId: string): SubscriptionPlan {
  const map: Record<string, SubscriptionPlan> = {
    [process.env.STRIPE_PRICE_PROPIETARIO ?? ""]: "propietario",
    [process.env.STRIPE_PRICE_INVERSIONISTA ?? ""]: "inversionista",
    [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "enterprise",
  };
  return map[priceId] ?? "free";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  // Dynamic import to avoid bundling stripe in edge runtime
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as unknown as {
      id: string;
      customer: string;
      status: string;
      current_period_end: number;
      items: { data: { price: { id: string } }[] };
      metadata?: { owner_id?: string };
    };
    const priceId = sub.items.data[0]?.price?.id ?? "";
    const plan = mapStripePlanToPlan(priceId);
    const ownerId = sub.metadata?.owner_id;
    if (!ownerId) return NextResponse.json({ received: true });

    // Live webhook may not subscribe to subscription.created — detect a new
    // activation by plan diff so the email fires on whichever event arrives
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("owner_id", ownerId)
      .maybeSingle();
    const isActivation = plan !== "free" && existing?.plan !== plan;

    await supabase.from("subscriptions").upsert(
      {
        owner_id: ownerId,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        plan,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );

    await supabase.from("profiles").update({ plan }).eq("id", ownerId);

    if (isActivation) {
      await notifyOwner(supabase, ownerId, (email) =>
        sendSubscriptionActivatedEmail(email, plan, APP_URL)
      );
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as { metadata?: { owner_id?: string } };
    const ownerId = sub.metadata?.owner_id;
    if (!ownerId) return NextResponse.json({ received: true });

    await supabase.from("subscriptions").update({ plan: "free", status: "canceled" }).eq("owner_id", ownerId);
    await supabase.from("profiles").update({ plan: "free" }).eq("id", ownerId);

    await notifyOwner(supabase, ownerId, (email) =>
      sendSubscriptionCancelledEmail(email, APP_URL)
    );
  }

  return NextResponse.json({ received: true });
}
