import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS, type PlanFeature, type SubscriptionPlan } from "@/lib/types";

const FEATURE_LABELS: Record<PlanFeature, string> = {
  sms: "los mensajes de texto",
  market: "el análisis de mercado",
  templates: "las plantillas personalizadas",
  expense_export: "la exportación de gastos",
  schedule_e: "el reporte Schedule E",
};

const PLAN_ORDER: SubscriptionPlan[] = ["free", "propietario", "inversionista", "enterprise"];

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<SubscriptionPlan> {
  const { data } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
  const plan = data?.plan as SubscriptionPlan | undefined;
  return plan && plan in PLAN_LIMITS ? plan : "free";
}

export function hasFeature(plan: SubscriptionPlan, feature: PlanFeature): boolean {
  return PLAN_LIMITS[plan][feature];
}

export function minimumPlanFor(feature: PlanFeature): SubscriptionPlan {
  return PLAN_ORDER.find((p) => PLAN_LIMITS[p][feature]) ?? "enterprise";
}

/**
 * Returns a 402 response when the signed-in user's plan lacks `feature`,
 * or null when the request may proceed.
 */
export async function requireFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: PlanFeature
): Promise<NextResponse | null> {
  const plan = await getPlan(supabase, userId);
  if (hasFeature(plan, feature)) return null;
  const required = minimumPlanFor(feature);
  return NextResponse.json(
    {
      error: "plan_required",
      feature,
      requiredPlan: required,
      message: `Esta función requiere un plan superior. Actualiza tu plan para usar ${FEATURE_LABELS[feature]}.`,
    },
    { status: 402 }
  );
}
