import type { createClient } from "@/lib/supabase-server";
import { daysBetween } from "@/lib/reminders";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Alert =
  | { kind: "expiring"; contractId: string; title: string; days: number }
  | { kind: "unsigned"; contractId: string; title: string; days: number }
  | { kind: "failed"; contractId: string; title: string; channel: string };

const EXPIRING_WINDOW_DAYS = 60;
const UNSIGNED_AFTER_DAYS = 3;

function label(c: { property: { name: string } | null; tenant: { full_name: string } | null }) {
  return [c.tenant?.full_name, c.property?.name].filter(Boolean).join(" · ") || "Contrato";
}

/** Items for the header bell and the dashboard "Hoy" queue, most urgent first. */
export async function getAlerts(supabase: Client, today = new Date()): Promise<Alert[]> {
  const iso = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + EXPIRING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const sentBefore = new Date(today.getTime() - UNSIGNED_AFTER_DAYS * 86_400_000).toISOString();
  const failedSince = new Date(today.getTime() - 14 * 86_400_000).toISOString();

  const [expiring, unsigned, failed] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, lease_end, property:properties(name), tenant:tenants(full_name)")
      .eq("status", "signed")
      .gte("lease_end", iso)
      .lte("lease_end", horizon)
      .order("lease_end")
      .limit(20),
    supabase
      .from("contracts")
      .select("id, sent_at, property:properties(name), tenant:tenants(full_name)")
      .eq("status", "sent")
      .lte("sent_at", sentBefore)
      .order("sent_at")
      .limit(20),
    supabase
      .from("contract_notification_logs")
      .select("contract_id, channel, sent_at")
      .eq("status", "failed")
      .gte("sent_at", failedSince)
      .order("sent_at", { ascending: false })
      .limit(10),
  ]);

  const alerts: Alert[] = [];
  for (const c of expiring.data ?? []) {
    alerts.push({ kind: "expiring", contractId: c.id, title: label(c), days: daysBetween(iso, c.lease_end) });
  }
  for (const c of unsigned.data ?? []) {
    if (!c.sent_at) continue;
    alerts.push({ kind: "unsigned", contractId: c.id, title: label(c), days: daysBetween(c.sent_at.slice(0, 10), iso) });
  }
  for (const f of failed.data ?? []) {
    alerts.push({ kind: "failed", contractId: f.contract_id, title: "", channel: f.channel });
  }
  return alerts;
}
