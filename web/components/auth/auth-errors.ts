/** Keys under `auth.errors` for friendly messages. */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "weakPassword"
  | "rateLimit"
  | "userExists"
  | "samePassword"
  | "network"
  | "generic";

/**
 * Maps a Supabase auth error (by `code`, `status`, or message text) to a
 * message key in the `auth.errors` namespace.
 */
export function authErrorKey(err: unknown): AuthErrorKey {
  const e = (err ?? {}) as { code?: string; status?: number; message?: string; name?: string };
  const code = e.code ?? "";
  const msg = (e.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "invalidCredentials";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "emailNotConfirmed";
  if (code === "weak_password" || msg.includes("password should") || msg.includes("weak password")) return "weakPassword";
  if (
    code.startsWith("over_") ||
    e.status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes")
  )
    return "rateLimit";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "userExists";
  if (code === "same_password" || msg.includes("different from the old")) return "samePassword";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "network";
  return "generic";
}
