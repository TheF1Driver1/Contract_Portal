import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE, normalizeReferralCode, referralDestination } from "@/lib/referrals/code";

// Public referral link (Plan 37): remembers the code for 60 days, then sends
// the visitor to signup (default) or pricing (?to=pricing, ?to=en).
// The code is only checked for shape here; signup looks it up.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeReferralCode(decodeURIComponent(raw));
  const res = NextResponse.redirect(new URL(referralDestination(req.nextUrl.searchParams.get("to")), req.url), 307);
  if (code) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      // Readable by the login page so it only calls the server when a code is waiting.
      // The code is public anyway (it is in the link); the server re-validates it.
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:",
    });
  }
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
