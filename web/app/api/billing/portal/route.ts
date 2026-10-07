import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

// Opens the Stripe Customer Portal for the signed-in landlord's own customer;
// falls back to the shared portal login link when there is no customer yet.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const { data: sub } = await createAdminClient()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sub?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    const stripe = await getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });
    return NextResponse.redirect(session.url, 303);
  }

  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_URL;
  if (!portalUrl) {
    return NextResponse.json({ error: "Customer portal not configured" }, { status: 503 });
  }
  return NextResponse.redirect(portalUrl, 303);
}
