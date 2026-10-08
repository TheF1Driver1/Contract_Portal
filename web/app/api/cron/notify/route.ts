import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { sendResendEmail, buildExpiryNotification } from "@/lib/notify";
import { addDays, daysBetween, pickReminder, type ReminderTrigger } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type TriggerRow = ReminderTrigger & { owner_id: string; send_email: boolean; send_sms: boolean };

type ContractRow = {
  id: string;
  owner_id: string;
  lease_end: string;
  property: { name?: string } | null;
  tenant: { full_name?: string; phone?: string | null; email?: string | null } | null;
  owner: { full_name?: string; phone?: string | null; email?: string | null; locale?: string | null } | null;
};

type LogRow = {
  contract_id: string;
  owner_id: string;
  trigger_id: string;
  days_before: number;
  channel: "email" | "sms";
  status: "sent" | "failed" | "suppressed";
  error_message: string | null;
};

// Vercel Cron calls with GET; POST stays available for manual runs.
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  // Fail closed: a missing secret must NOT open this endpoint (sends billed email/SMS)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const today = startedAt.slice(0, 10);
  const errors: string[] = [];
  let sentEmail = 0;
  let processed = 0;
  let expired = 0;

  try {
    const { data: triggerData, error: triggerErr } = await supabase
      .from("notification_triggers")
      .select("id, owner_id, days_before, send_sms, send_email")
      .eq("is_active", true);
    if (triggerErr) throw new Error(triggerErr.message);
    const triggers = (triggerData ?? []) as TriggerRow[];

    if (triggers.length > 0) {
      const maxDays = Math.max(...triggers.map((t) => t.days_before));
      const { data: contractData, error: contractErr } = await supabase
        .from("contracts")
        .select(`
          id, owner_id, lease_end,
          property:properties(name),
          tenant:tenants(full_name, phone, email),
          owner:profiles(full_name, phone, email, locale)
        `)
        .gte("lease_end", today)
        .lte("lease_end", addDays(today, maxDays))
        .eq("suppress_notifications", false)
        .not("status", "in", '("draft","expired")');
      if (contractErr) throw new Error(contractErr.message);
      const contracts = (contractData ?? []) as unknown as ContractRow[];
      processed = contracts.length;

      const handled = new Map<string, Set<string>>(); // contract -> trigger ids already logged
      if (contracts.length > 0) {
        const { data: logs } = await supabase
          .from("contract_notification_logs")
          .select("contract_id, trigger_id, status")
          .in("contract_id", contracts.map((c) => c.id))
          .in("status", ["sent", "suppressed"]);
        for (const l of logs ?? []) {
          if (!l.trigger_id) continue;
          if (!handled.has(l.contract_id)) handled.set(l.contract_id, new Set());
          handled.get(l.contract_id)!.add(l.trigger_id);
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";
      const newLogs: LogRow[] = [];

      for (const c of contracts) {
        const ownerTriggers = triggers.filter((t) => t.owner_id === c.owner_id && t.send_email);
        const daysLeft = daysBetween(today, c.lease_end);
        const { send, skip } = pickReminder(ownerTriggers, daysLeft, handled.get(c.id) ?? new Set());

        for (const t of skip) {
          newLogs.push({
            contract_id: c.id, owner_id: c.owner_id, trigger_id: t.id, days_before: t.days_before,
            channel: "email", status: "suppressed", error_message: "superseded by a closer reminder",
          });
        }
        if (!send) continue;

        const { subject, emailHtml } = buildExpiryNotification({
          tenantName: c.tenant?.full_name ?? "",
          propertyName: c.property?.name ?? "",
          daysLeft,
          contractUrl: `${appUrl}/contracts/${c.id}`,
          locale: c.owner?.locale,
        });

        let err: string | null = null;
        const landlordEmail = c.owner?.email ?? null;
        if (!landlordEmail) {
          err = "no email";
        } else {
          try {
            await sendResendEmail(landlordEmail, subject, emailHtml);
            sentEmail++;
          } catch (e) {
            err = (e as Error).message;
            errors.push(`email ${c.id}: ${err}`);
          }
        }
        newLogs.push({
          contract_id: c.id, owner_id: c.owner_id, trigger_id: send.id, days_before: send.days_before,
          channel: "email", status: err ? "failed" : "sent", error_message: err,
        });
      }

      if (newLogs.length > 0) {
        const { error: logErr } = await supabase.from("contract_notification_logs").insert(newLogs);
        if (logErr) errors.push(`logs: ${logErr.message}`);
      }
    }

    const { data: expiredRows, error: expireErr } = await supabase
      .from("contracts")
      .update({ status: "expired" })
      .lt("lease_end", today)
      .not("status", "in", '("draft","expired")')
      .select("id");
    if (expireErr) errors.push(`expire: ${expireErr.message}`);
    expired = expiredRows?.length ?? 0;
  } catch (e) {
    errors.push((e as Error).message);
  }

  const summary = { processed, sent_email: sentEmail, expired, errors };
  await supabase.from("cron_runs").insert({
    job: "notify",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ok: errors.length === 0,
    summary,
  });
  if (errors.length > 0) {
    console.error(JSON.stringify({ level: "error", msg: "cron notify finished with errors", ...summary }));
  }

  return NextResponse.json(summary, { status: errors.length > 0 ? 500 : 200 });
}
