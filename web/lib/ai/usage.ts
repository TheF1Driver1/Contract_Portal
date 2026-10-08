import type { SubscriptionPlan } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase-server";

export type AiFeature = "receipt" | "clause_explain" | "translate" | "notice" | "qa";

/** Monthly calls per plan and feature. Keeps cost bounded per account. */
export const AI_MONTHLY_LIMITS: Record<SubscriptionPlan, Record<AiFeature, number>> = {
  free: { receipt: 5, clause_explain: 20, translate: 5, notice: 5, qa: 10 },
  propietario: { receipt: 60, clause_explain: 200, translate: 50, notice: 50, qa: 100 },
  inversionista: { receipt: 300, clause_explain: 1000, translate: 200, notice: 200, qa: 400 },
  enterprise: { receipt: 2000, clause_explain: 5000, translate: 1000, notice: 1000, qa: 2000 },
};

type Admin = ReturnType<typeof createAdminClient>;

function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Remaining calls this calendar month (UTC). */
export async function aiQuotaRemaining(admin: Admin, ownerId: string, plan: SubscriptionPlan, feature: AiFeature): Promise<number> {
  const { count } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("feature", feature)
    .gte("created_at", monthStart());
  return Math.max(0, AI_MONTHLY_LIMITS[plan][feature] - (count ?? 0));
}

export async function recordAiUsage(
  admin: Admin,
  ownerId: string,
  feature: AiFeature,
  usage: { model: string; input_tokens?: number | null; output_tokens?: number | null }
): Promise<void> {
  const { error } = await admin.from("ai_usage_events").insert({
    owner_id: ownerId,
    feature,
    model: usage.model,
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
  });
  if (error) console.error(JSON.stringify({ level: "warn", msg: "ai usage not recorded", feature, err: error.message }));
}
