import type { createClient } from "@/lib/supabase-server";
import { daysBetween } from "@/lib/reminders";
import type { MaintenanceUrgency } from "@/lib/db";
import { renewalCandidates, RENEWAL_WINDOW } from "@/lib/maintenance/logic";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Alert =
  | { kind: "expiring"; contractId: string; title: string; days: number }
  | { kind: "unsigned"; contractId: string; title: string; days: number }
  | { kind: "failed"; contractId: string; title: string; channel: string }
  // Plan 35: unpaid CRIM installment due within 30 days.
  | { kind: "crim"; propertyId: string; title: string; days: number }
  // Plan 36: open urgent/emergency repairs and leases to renew (60–90 days, no renewal draft yet).
  | { kind: "maintenance"; requestId: string; contractId: string | null; title: string; property: string; urgency: MaintenanceUrgency; days: number }
  | { kind: "renewal"; contractId: string; title: string; days: number };

/** Where an alert links to. */
export function alertHref(a: Alert): string {
  if (a.kind === "crim") return `/properties?crim=${a.propertyId}`;
  return a.kind === "maintenance" ? `/maintenance/${a.requestId}` : `/contracts/${a.contractId}`;
}

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

  const messagesSince = new Date(today.getTime() - 7 * 86_400_000).toISOString();
  const crimHorizon = new Date(today.getTime() + CRIM_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  const lifecycleAlerts = getLifecycleAlerts(supabase, today, iso).catch(() => ({ maintenance: [] as Alert[], renewal: [] as Alert[] }));
  const [expiring, unsigned, failed, failedMessages, crim] = await Promise.all([
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
    // Failed deliveries from the message log (Plan 34).
    supabase
      .from("message_log")
      .select("contract_id, channel, created_at")
      .eq("status", "failed")
      .eq("direction", "outbound")
      .not("contract_id", "is", null)
      .gte("created_at", messagesSince)
      .order("created_at", { ascending: false }),
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
  for (const f of failedMessages.data ?? []) {
    if (f.contract_id) alerts.push({ kind: "failed", contractId: f.contract_id, title: "", channel: f.channel });
  }
  // Missing table (migration 025 not applied yet) leaves `data` null: no CRIM alerts.
  for (const b of crim.data ?? []) {
    const name = (b.property as { name?: string } | null)?.name ?? "";
    alerts.push({ kind: "crim", propertyId: b.property_id, title: name ? `CRIM · ${name}` : "CRIM", days: daysBetween(iso, b.due_date) });
  }

  // Plan 36: urgent repairs go first, renewals after the contract alerts.
  const lifecycle = await lifecycleAlerts;
  alerts.unshift(...lifecycle.maintenance);
  const shown = new Set<string | null>(alerts.flatMap((a) => (a.kind === "expiring" ? [a.contractId] : [])));
  alerts.push(...lifecycle.renewal.filter((a) => !(a.kind === "renewal" && shown.has(a.contractId))));
  return alerts;
}

/** Plan 36: open urgent/emergency repairs, and signed leases ending in 60–90 days with no renewal yet. */
async function getLifecycleAlerts(supabase: Client, today: Date, iso: string): Promise<{ maintenance: Alert[]; renewal: Alert[] }> {
  const renewalFrom = new Date(today.getTime() + RENEWAL_WINDOW.from * 86_400_000).toISOString().slice(0, 10);
  const renewalTo = new Date(today.getTime() + RENEWAL_WINDOW.to * 86_400_000).toISOString().slice(0, 10);
  const [urgent, ending] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id, contract_id, property_id, title, urgency, status, created_at")
      .in("status", ["open", "scheduled", "in_progress"])
      .in("urgency", ["urgent", "emergency"])
      .order("created_at")
      .limit(10),
    supabase
      .from("contracts")
      .select("id, status, lease_end, parent_contract_id, property:properties(name), tenant:tenants(full_name)")
      .eq("status", "signed")
      .gte("lease_end", renewalFrom)
      .lte("lease_end", renewalTo)
      .limit(20),
  ]);

  const maintenance: Alert[] = [];
  const reqs = urgent.data ?? [];
  if (reqs.length) {
    const { data: props } = await supabase.from("properties").select("id, name").in("id", [...new Set(reqs.map((r) => r.property_id))]);
    const names = new Map((props ?? []).map((p) => [p.id, p.name as string]));
    // Emergencies first, then the oldest.
    for (const r of [...reqs].sort((a, b) => Number(b.urgency === "emergency") - Number(a.urgency === "emergency"))) {
      maintenance.push({
        kind: "maintenance",
        requestId: r.id,
        contractId: r.contract_id,
        title: r.title,
        property: names.get(r.property_id) ?? "",
        urgency: r.urgency,
        days: Math.max(0, daysBetween(r.created_at.slice(0, 10), iso)),
      });
    }
  }

  const renewal: Alert[] = [];
  const endingRows = ending.data ?? [];
  if (endingRows.length) {
    const { data: children } = await supabase
      .from("contracts")
      .select("id, status, lease_end, parent_contract_id")
      .in("parent_contract_id", endingRows.map((c) => c.id));
    const byId = new Map(endingRows.map((c) => [c.id, c]));
    for (const c of renewalCandidates([...endingRows, ...(children ?? [])], iso)) {
      const row = byId.get(c.id);
      if (row) renewal.push({ kind: "renewal", contractId: c.id, title: label(row), days: c.days });
    }
  }
  return { maintenance, renewal };
}
