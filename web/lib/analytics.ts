import { track } from "@vercel/analytics/server";

// Activation funnel (Plan 32). Vercel custom events need a Pro plan; on
// Hobby these calls do nothing. Never send personal data as properties.
export type FunnelEvent =
  | "signup"
  | "property_created"
  | "tenant_created"
  | "contract_created"
  | "contract_sent"
  | "contract_signed"
  | "checkout_started"
  | "subscribed"
  | "ledger_enabled"
  | "payment_recorded";

export async function trackEvent(event: FunnelEvent, props?: Record<string, string | number | boolean | null>) {
  try {
    await track(event, props);
  } catch {
    // Analytics must never break a user flow.
  }
}
