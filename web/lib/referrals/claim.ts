import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-server";
import { REFERRAL_COOKIE, parseReferralCookie } from "@/lib/referrals/code";
import { attachReferral } from "@/lib/referrals/service";
import { trackEvent } from "@/lib/analytics";

/**
 * Attaches the referral cookie (set by /r/<code>) to a just-created account
 * and clears it. Used after signup and by the email-confirmation callback.
 */
export async function claimReferralCookie(user: { id: string; created_at?: string | null }): Promise<boolean> {
  const jar = await cookies();
  const code = parseReferralCookie(jar.get(REFERRAL_COOKIE)?.value);
  if (!code) return false;
  const decision = await attachReferral(createAdminClient(), { code, userId: user.id, userCreatedAt: user.created_at });
  jar.delete(REFERRAL_COOKIE);
  if (decision.attach) await trackEvent("referral_signup");
  return decision.attach;
}
