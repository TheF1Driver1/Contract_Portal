import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { sendTwilioSms, sendResendEmail, buildExpiryNotification } from "@/lib/notify";
import type { NotificationTrigger } from "@/lib/types";

export const dynamic   = "force-dynamic";
export const maxDuration = 60;

type TriggerRow = Pick<NotificationTrigger, "id" | "owner_id" | "days_before" | "send_sms" | "send_email">;

export async function POST(req: Request) {
  // Vercel Cron (and manual callers) must supply the secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // today in UTC as YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Load all active triggers ────────────────────────────────────────────
  const { data: triggers, error: triggerErr } = await supabase
    .from("notification_triggers")
    .select("id, owner_id, days_before, send_sms, send_email")
    .eq("is_active", true);

  if (triggerErr) {
    return NextResponse.json({ error: triggerErr.message }, { status: 500 });
  }

  if (!triggers || triggers.length === 0) {
    await markExpired(supabase, today);
    return NextResponse.json({ processed: 0, sent_sms: 0, sent_email: 0, expired: 0 });
  }

  // ── 2. Compute target lease_end dates ──────────────────────────────────────
  const uniqueDays = Array.from(new Set((triggers as TriggerRow[]).map((t) => t.days_before)));
  const targetDates = uniqueDays.map((d) => addDays(today, d));

  // ── 3. Fetch matching contracts ────────────────────────────────────────────
  const { data: contracts, error: contractErr } = await supabase
    .from("contracts")
    .select(`
      id, owner_id, lease_end, suppress_notifications,
      property:properties(name),
      tenant:tenants(full_name, phone, email),
      owner:profiles(full_name, phone, email)
    `)
    .in("lease_end", targetDates)
    .eq("suppress_notifications", false)
    .not("status", "in", '("draft","expired")');

  if (contractErr) {
    return NextResponse.json({ error: contractErr.message }, { status: 500 });
  }

  // ── 4. Load existing sent logs for these contracts ─────────────────────────
  const contractIds = (contracts ?? []).map((c) => c.id);
  const triggerIds  = (triggers as TriggerRow[]).map((t) => t.id);

  let sentLogs: { contract_id: string; trigger_id: string | null; channel: string }[] = [];
  if (contractIds.length > 0) {
    const { data: logs } = await supabase
      .from("contract_notification_logs")
      .select("contract_id, trigger_id, channel")
      .in("contract_id", contractIds)
      .in("trigger_id", triggerIds)
      .eq("status", "sent");
    sentLogs = logs ?? [];
  }

  const alreadySent = new Set(
    sentLogs.map((l) => `${l.contract_id}:${l.trigger_id}:${l.channel}`)
  );

  // ── 5. Send notifications ──────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  let sentSms   = 0;
  let sentEmail = 0;
  const errors: string[] = [];
  const newLogs: {
    contract_id: string; owner_id: string; trigger_id: string;
    days_before: number; channel: string; status: string; error_message: string | null;
  }[] = [];

  for (const contract of contracts ?? []) {
    const c = contract as {
      id: string; owner_id: string; lease_end: string;
      property: { name?: string } | null;
      tenant:   { full_name?: string; phone?: string | null; email?: string | null } | null;
      owner:    { full_name?: string; phone?: string | null; email?: string | null } | null;
    };

    const matchingTriggers = (triggers as TriggerRow[]).filter(
      (t) => t.owner_id === c.owner_id && addDays(today, t.days_before) === c.lease_end
    );

    const daysLeft  = daysBetween(today, c.lease_end);
    const propName  = c.property?.name ?? "your property";
    const tenantName = c.tenant?.full_name ?? "";
    const contractUrl = `${appUrl}/contracts/${c.id}`;

    const { sms, subject, emailHtml } = buildExpiryNotification({
      tenantName,
      propertyName: propName,
      daysLeft,
      contractUrl,
    });

    for (const trigger of matchingTriggers) {
      // SMS to landlord
      if (trigger.send_sms) {
        const key = `${c.id}:${trigger.id}:sms`;
        if (!alreadySent.has(key)) {
          const landlordPhone = c.owner?.phone ?? null;
          let err: string | null = null;
          if (landlordPhone) {
            try {
              await sendTwilioSms(landlordPhone, sms);
              sentSms++;
            } catch (e) {
              err = (e as Error).message;
              errors.push(`sms ${c.id}: ${err}`);
            }
          } else {
            err = "no phone";
          }
          newLogs.push({
            contract_id: c.id, owner_id: c.owner_id, trigger_id: trigger.id,
            days_before: trigger.days_before, channel: "sms",
            status: err ? "failed" : "sent", error_message: err,
          });
        }
      }

      // Email to landlord
      if (trigger.send_email) {
        const key = `${c.id}:${trigger.id}:email`;
        if (!alreadySent.has(key)) {
          const landlordEmail = c.owner?.email ?? null;
          let err: string | null = null;
          if (landlordEmail) {
            try {
              await sendResendEmail(landlordEmail, subject, emailHtml);
              sentEmail++;
            } catch (e) {
              err = (e as Error).message;
              errors.push(`email ${c.id}: ${err}`);
            }
          } else {
            err = "no email";
          }
          newLogs.push({
            contract_id: c.id, owner_id: c.owner_id, trigger_id: trigger.id,
            days_before: trigger.days_before, channel: "email",
            status: err ? "failed" : "sent", error_message: err,
          });
        }
      }
    }
  }

  // ── 6. Batch insert logs ───────────────────────────────────────────────────
  if (newLogs.length > 0) {
    await supabase.from("contract_notification_logs").insert(newLogs);
  }

  // ── 7. Mark expired contracts ──────────────────────────────────────────────
  const expired = await markExpired(supabase, today);

  return NextResponse.json({
    processed: (contracts ?? []).length,
    sent_sms:  sentSms,
    sent_email: sentEmail,
    expired,
    errors,
  });
}

async function markExpired(
  supabase: ReturnType<typeof createAdminClient>,
  today: string
): Promise<number> {
  const { data } = await supabase
    .from("contracts")
    .update({ status: "expired" })
    .lt("lease_end", today)
    .not("status", "in", '("draft","expired")')
    .select("id");
  return data?.length ?? 0;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / 86_400_000);
}
