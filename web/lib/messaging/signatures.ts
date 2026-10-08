// Webhook signature checks for Twilio and Resend (Svix). Pure, so they are
// unit-tested; routes reject any request that fails them.
import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + each POST param
 * sorted by name, written as name + value)).
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/** True when `signature` matches for any of the candidate URLs (proxies can rewrite the host). */
export function verifyTwilioSignature(opts: {
  authToken: string | undefined;
  signature: string | null;
  urls: string[];
  params: Record<string, string>;
}): boolean {
  if (!opts.authToken || !opts.signature) return false;
  return opts.urls.some((u) => safeEqual(twilioSignature(opts.authToken!, u, opts.params), opts.signature!));
}

const SVIX_TOLERANCE_S = 5 * 60;

/** Svix scheme used by Resend: v1 = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)). */
export function svixSignature(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvixSignature(opts: {
  secret: string | undefined;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number; // ms, for tests
}): boolean {
  const { secret, id, timestamp, signature, body } = opts;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SVIX_TOLERANCE_S) return false;
  const expected = svixSignature(secret, id, timestamp, body);
  // Header holds space-separated "v1,<sig>" entries (several during key rotation).
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && safeEqual(sig, expected);
  });
}
