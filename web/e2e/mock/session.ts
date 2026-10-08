import type { BrowserContext } from "@playwright/test";
import { USER } from "./fixtures.mjs";

/** Puts a session cookie for the mock project into the browser context. */
export async function signInMock(context: BrowserContext, baseURL: string, supabaseUrl: string, opts: { role?: "landlord" | "tenant" } = {}) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, email: USER.email, role: "authenticated", aud: "authenticated", exp, app_role: opts.role ?? "landlord", locale: "es" })}.mock`;
  const session = { access_token: accessToken, refresh_token: "mock", token_type: "bearer", expires_in: 3600, expires_at: exp, user: USER };
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await context.addCookies([
    { name: `sb-${ref}-auth-token`, value: `base64-${b64(session)}`, url: baseURL },
    { name: "NEXT_LOCALE", value: "es", url: baseURL },
  ]);
}
