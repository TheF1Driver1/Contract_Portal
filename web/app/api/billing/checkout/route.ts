import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const PRICE_IDS: Record<string, string | undefined> = {
  propietario: process.env.STRIPE_PRICE_PROPIETARIO,
  inversionista: process.env.STRIPE_PRICE_INVERSIONISTA,
};

export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  const priceId = PRICE_IDS[plan];

  if (!priceId) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/signup?plan=${plan}`, req.url));
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { owner_id: user.id },
    subscription_data: { metadata: { owner_id: user.id } },
  });

  return NextResponse.redirect(session.url!);
}
