// Referral codes and cookie rules (Plan 37). Pure helpers, safe on client and server.

/** No 0/O, 1/I/L: a code read aloud or copied from a phone stays unambiguous. */
export const REFERRAL_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_COOKIE = "cos_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days, in seconds
/** A referral only attaches to an account created this recently (signup or email confirmation). */
export const REFERRAL_ATTACH_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

const CODE_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/** Random code from the alphabet. `random` returns bytes (crypto by default; injectable for tests). */
export function generateReferralCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely (256 % 31 != 0).
  const limit = 256 - (256 % REFERRAL_ALPHABET.length);
  while (out.length < REFERRAL_CODE_LENGTH) {
    for (const b of random(REFERRAL_CODE_LENGTH * 2)) {
      if (b >= limit) continue;
      out.push(REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length]);
      if (out.length === REFERRAL_CODE_LENGTH) break;
    }
  }
  return out.join("");
}

/** Accepts what a person might type or paste ("abcd-efgh ", lower case); null when it cannot be a code. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** True when document.cookie carries a referral code (client-side hint only). */
export const hasReferralCookie = (cookieHeader: string) => new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=`).test(cookieHeader);

/** Reads the referral cookie value; anything malformed is ignored. */
export const parseReferralCookie = (value: string | null | undefined) => normalizeReferralCode(value);

export type InsertOutcome = "ok" | "collision" | "error";

/**
 * Tries fresh codes until one inserts. A unique-violation on `code` is a
 * collision and retries; any other error stops. Returns the code or null.
 */
export async function insertUniqueCode(
  tryInsert: (code: string) => Promise<InsertOutcome>,
  generate: () => string = generateReferralCode,
  attempts = 5
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const code = generate();
    const outcome = await tryInsert(code);
    if (outcome === "ok") return code;
    if (outcome === "error") return null;
  }
  return null;
}

export type AttachDecision =
  | { attach: true }
  | { attach: false; reason: "no_code" | "unknown_code" | "self_referral" | "existing_account" | "not_landlord" };

/** Whether a new account should be recorded as referred by the code's owner. */
export function attachDecision(input: {
  code: string | null;
  referrerId: string | null;
  userId: string;
  userCreatedAt: string | null | undefined;
  role?: string | null;
  now?: Date;
}): AttachDecision {
  if (!input.code) return { attach: false, reason: "no_code" };
  if (!input.referrerId) return { attach: false, reason: "unknown_code" };
  if (input.referrerId === input.userId) return { attach: false, reason: "self_referral" };
  if (input.role && input.role !== "landlord") return { attach: false, reason: "not_landlord" };
  const created = input.userCreatedAt ? Date.parse(input.userCreatedAt) : NaN;
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(created) || now - created > REFERRAL_ATTACH_WINDOW_MS) return { attach: false, reason: "existing_account" };
  return { attach: true };
}

/** Where /r/<code> sends the visitor. */
export function referralDestination(to: string | null): "/signup" | "/pricing" | "/en/pricing" {
  if (to === "pricing") return "/pricing";
  if (to === "en") return "/en/pricing";
  return "/signup";
}

export const referralLink = (baseUrl: string, code: string) => `${baseUrl.replace(/\/$/, "")}/r/${code}`;
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
