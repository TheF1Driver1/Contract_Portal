import type { createClient } from "@/lib/supabase-server";
import { daysBetween } from "@/lib/reminders";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Alert =
  | { kind: "expiring"; contractId: string; title: string; days: number }
  | { kind: "unsigned"; contractId: string; title: string; days: number }
  | { kind: "failed"; contractId: string; title: string; channel: string }
  // Plan 35: unpaid CRIM installment due within 30 days.
  | { kind: "crim"; propertyId: string; title: string; days: number };

/** Where an alert leads. */
export const alertHref = (a: Alert) => (a.kind === "crim" ? `/properties?crim=${a.propertyId}` : `/contracts/${a.contractId}`);

const CRIM_WINDOW_DAYS = 30;

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

  const crimHorizon = new Date(today.getTime() + CRIM_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [expiring, unsigned, failed, crim] = await Promise.all([
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
    supabase
      .from("crim_bills")
      .select("property_id, due_date, property:properties(name)")
      .is("paid_on", null)
      .is("voided_at", null)
      .gte("due_date", iso)
      .lte("due_date", crimHorizon)
      .order("due_date")
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
  // Missing table (migration 025 not applied yet) leaves `data` null: no CRIM alerts.
  for (const b of crim.data ?? []) {
    const name = (b.property as { name?: string } | null)?.name ?? "";
    alerts.push({ kind: "crim", propertyId: b.property_id, title: name ? `CRIM · ${name}` : "CRIM", days: daysBetween(iso, b.due_date) });
  }
  return alerts;
}
