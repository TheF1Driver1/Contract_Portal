import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, non-expiring unsubscribe links: /unsubscribe?u=<user id>&s=<hmac>.
function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET not configured");
  return s;
}

export function unsubscribeSignature(userId: string): string {
  return createHmac("sha256", secret()).update(`lifecycle:${userId}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string | null | undefined, sig: string | null | undefined): boolean {
  if (!userId || !sig || !/^[0-9a-f-]{36}$/i.test(userId)) return false;
  if (!process.env.UNSUBSCRIBE_SECRET && !process.env.CRON_SECRET) return false;
  const expected = Buffer.from(unsubscribeSignature(userId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(appUrl: string, userId: string): string {
  return `${appUrl}/unsubscribe?u=${userId}&s=${unsubscribeSignature(userId)}`;
}

/** One-click target for the List-Unsubscribe header (RFC 8058, POST). */
export function oneClickUnsubscribeUrl(appUrl: string, userId: string): string {
  return `${appUrl}/api/unsubscribe?u=${userId}&s=${unsubscribeSignature(userId)}`;
}
