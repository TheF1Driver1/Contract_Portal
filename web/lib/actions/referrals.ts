"use server";

import { createAdminClient, createClient } from "@/lib/supabase-server";
import { referralLink } from "@/lib/referrals/code";
import { countReferrals, ensureReferralCode, type ReferralStats } from "@/lib/referrals/service";
import { claimReferralCookie } from "@/lib/referrals/claim";

export type MyReferral = { ok: true; code: string; link: string; stats: ReferralStats } | { ok: false; error: string };

const BASE_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";

/** The signed-in landlord's referral link and counts (creates the code on first view). */
export async function getMyReferral(): Promise<MyReferral> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };

  // Codes are written only by the service role (migration 030); the owner is the session user.
  const code = await ensureReferralCode(createAdminClient(), user.id);
  if (!code) return { ok: false, error: "No se pudo crear tu enlace de referido." };

  const { data: rows } = await supabase.from("referrals").select("status").eq("referrer_id", user.id);
  return { ok: true, code, link: referralLink(BASE_URL(), code), stats: countReferrals(rows ?? []) };
}

/** Attaches the referral cookie to the signed-in account right after signup. */
export async function claimReferral(): Promise<{ ok: true; attached: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // No session yet (email confirmation pending): the cookie stays for /auth/callback.
  if (!user) return { ok: true, attached: false };
  return { ok: true, attached: await claimReferralCookie(user) };
}
