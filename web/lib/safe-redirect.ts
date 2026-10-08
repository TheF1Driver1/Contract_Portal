/** Returns `target` only if it is a same-site path; otherwise `fallback`. Prevents open redirects. */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(target)) return fallback;
  return target;
}
