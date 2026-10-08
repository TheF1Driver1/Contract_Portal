import { PLAN_LIMITS } from "@/lib/types";

// Public price list. Limits come from PLAN_LIMITS (mirrored by the
// plan_entitlements table) so the pricing page can't drift from enforcement.
// Set `yearly` once yearly Stripe prices exist; the page shows the
// monthly/yearly toggle only when at least one plan has a yearly price.
export const PRICING = [
  { plan: "free", monthly: 0, yearly: null, highlighted: false },
  { plan: "propietario", monthly: 29, yearly: null, highlighted: true },
  { plan: "inversionista", monthly: 99, yearly: null, highlighted: false },
] as const satisfies readonly { plan: keyof typeof PLAN_LIMITS; monthly: number; yearly: number | null; highlighted: boolean }[];

export type PricedPlan = (typeof PRICING)[number]["plan"];

/** Feature rows shown on cards and the comparison table, in order. */
export function planFeatures(plan: keyof typeof PLAN_LIMITS) {
  const l = PLAN_LIMITS[plan];
  const n = (v: number) => (Number.isFinite(v) ? v : -1);
  return [
    { key: "properties", values: { count: n(l.max_properties) }, included: true },
    { key: "contracts", values: { count: n(l.max_contracts_per_month) }, included: true },
    { key: "template", included: true },
    { key: "esign", included: true },
    { key: "email", included: true },
    { key: "sms", included: l.sms },
    { key: "templates", included: l.templates },
    { key: "expenses", included: l.expense_export },
    { key: "market", included: l.market },
    { key: "scheduleE", included: l.schedule_e },
    { key: "managers", values: { count: n(l.managers) }, included: l.managers !== 0 },
  ] as { key: string; values?: Record<string, number>; included: boolean }[];
}

export const hasYearlyPricing = PRICING.some((p) => p.yearly !== null);
