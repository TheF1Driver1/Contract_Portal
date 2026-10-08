import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Single-use signing link token (sent to the signer; only its hash is stored). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export const hashToken = (token: string) => sha256Hex(`signing-token:${token}`);

/** Six-digit one-time code. */
export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are bound to the signer so a hash can't be replayed for another signer. */
export const hashOtp = (signerId: string, code: string) => sha256Hex(`signing-otp:${signerId}:${code.trim()}`);

export function safeEqualHex(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Stable JSON (sorted keys) so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** Fields that make up the agreement; signers sign this content. */
export const AGREEMENT_FIELDS = [
  "id", "contract_type", "unit_number", "lease_start", "lease_end", "lease_months", "rent_amount",
  "rent_amount_verbal", "security_deposit", "payment_due_day", "late_fee_day", "late_fee_type",
  "late_fee_grace_period_days", "late_fee_fixed_amount", "late_fee_daily_amount", "occupant_names",
  "occupant_count", "key_count", "amenities", "governing_law", "tenant_snapshot", "property_snapshot",
] as const;

/** SHA-256 of the agreement terms, snapshots and custom clauses. */
export function agreementHash(contract: Record<string, unknown>, clauses: { title: string; body: string }[]): string {
  const terms = Object.fromEntries(AGREEMENT_FIELDS.map((k) => [k, contract[k] ?? null]));
  return sha256Hex(canonicalJson({ terms, clauses: clauses.map((c) => ({ title: c.title, body: c.body })) }));
}
