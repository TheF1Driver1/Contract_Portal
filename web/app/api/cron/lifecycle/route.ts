import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { sendResendEmail } from "@/lib/notify";
import { daysSince, LIFECYCLE_MAX_AGE_DAYS, nextLifecycleStep } from "@/lib/lifecycle/steps";
import { buildLifecycleEmail } from "@/lib/lifecycle/email";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/lifecycle/unsubscribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls with GET; POST stays available for manual runs.
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

const count = (rows: { owner_id: string }[] | null) => {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.owner_id, (m.get(r.owner_id) ?? 0) + 1);
  return m;
};

async function run(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const startedAt = now.toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";
  const errors: string[] = [];
  let sent = 0;
  let candidates = 0;

  try {
    const since = new Date(now.getTime() - (LIFECYCLE_MAX_AGE_DAYS + 1) * 86_400_000).toISOString();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, locale, created_at")
      .eq("role", "landlord")
      .eq("lifecycle_emails", true)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const users = (profiles ?? []).filter((p) => p.email && p.created_at);
    candidates = users.length;

    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const [{ data: props }, { data: contracts }, { data: logs }] = await Promise.all([
        supabase.from("properties").select("owner_id").in("owner_id", ids),
        supabase.from("contracts").select("owner_id, status").in("owner_id", ids),
        supabase.from("lifecycle_email_log").select("user_id, step").in("user_id", ids),
      ]);
      const propCount = count(props);
      const contractCount = count(contracts);
      const sentCount = count((contracts ?? []).filter((c) => c.status === "sent" || c.status === "signed"));
      const sentSteps = new Map<string, Set<string>>();
      for (const l of logs ?? []) {
        if (!sentSteps.has(l.user_id)) sentSteps.set(l.user_id, new Set());
        sentSteps.get(l.user_id)!.add(l.step);
      }

      for (const u of users) {
        const step = nextLifecycleStep(
          daysSince(u.created_at!, now),
          { properties: propCount.get(u.id) ?? 0, contracts: contractCount.get(u.id) ?? 0, sentForSignature: sentCount.get(u.id) ?? 0 },
          sentSteps.get(u.id) ?? new Set()
        );
        if (!step) continue;

        // Claim the step first: the primary key keeps overlapping runs from double-sending.
        const { data: claimed, error: claimErr } = await supabase
          .from("lifecycle_email_log")
          .upsert({ user_id: u.id, step }, { onConflict: "user_id,step", ignoreDuplicates: true })
          .select("user_id");
        if (claimErr) {
          errors.push(`claim ${u.id}: ${claimErr.message}`);
          continue;
        }
        if (!claimed?.length) continue;

        const unsub = unsubscribeUrl(appUrl, u.id);
        const { subject, html } = buildLifecycleEmail({ step, name: u.full_name, locale: u.locale, appUrl, unsubscribeUrl: unsub });
        try {
          await sendResendEmail(u.email!, subject, html, undefined, {
            "List-Unsubscribe": `<${oneClickUnsubscribeUrl(appUrl, u.id)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          });
          sent++;
        } catch (e) {
          errors.push(`send ${u.id}: ${(e as Error).message}`);
          // Release the claim so tomorrow's run can retry inside the window.
          await supabase.from("lifecycle_email_log").delete().eq("user_id", u.id).eq("step", step);
        }
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  const summary = { candidates, sent, errors };
  await supabase.from("cron_runs").insert({ job: "lifecycle", started_at: startedAt, finished_at: new Date().toISOString(), ok: errors.length === 0, summary });
  if (errors.length > 0) console.error(JSON.stringify({ level: "error", msg: "cron lifecycle finished with errors", ...summary }));
  return NextResponse.json(summary, { status: errors.length > 0 ? 500 : 200 });
}
