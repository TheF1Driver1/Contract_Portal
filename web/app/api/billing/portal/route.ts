import { NextResponse } from "next/server";

export async function GET() {
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_URL;
  if (!portalUrl) {
    return NextResponse.json({ error: "Customer portal not configured" }, { status: 503 });
  }
  return NextResponse.redirect(portalUrl);
}
