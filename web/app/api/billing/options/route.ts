import { NextResponse } from "next/server";
import { billingOptions } from "@/lib/stripe";

// Lets the (client) billing page know whether yearly prices and a trial exist.
export function GET() {
  return NextResponse.json(billingOptions(), { headers: { "Cache-Control": "public, max-age=300" } });
}
