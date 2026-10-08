import { trackEvent } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { getStripe, PAID_PLAN_PRICES } from "@/lib/stripe";
import { rateLimitWrite } from "@/lib/rate-limit";

// GET has no side effects: link prefetching used to create a Checkout Session per view.
export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  return NextResponse.redirect(new URL(plan ? `/settings/billing?plan=${encodeURIComponent(plan)}` : "/pricing", req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const plan = String(form?.get("plan") ?? req.nextUrl.searchParams.get("plan") ?? "");
  const priceId = PAID_PLAN_PRICES[plan as keyof typeof PAID_PLAN_PRICES];
  if (!priceId) {
    return NextResponse.redirect(new URL("/pricing", req.url), 303);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/signup?plan=${encodeURIComponent(plan)}`, req.url), 303);
  }

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const stripe = await getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  // Reuse the Stripe customer so one landlord never ends up with several.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : { customer_email: user.email }),
    client_reference_id: user.id,
    allow_promotion_codes: true,
    metadata: { owner_id: user.id },
    subscription_data: { metadata: { owner_id: user.id } },
  });

  await trackEvent("checkout_started", { plan });
  return NextResponse.redirect(session.url!, 303);
}
