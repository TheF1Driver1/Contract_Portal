import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { todayPR } from "@/lib/rent/service";
import { runDailyMessages } from "@/lib/messaging/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls with GET; POST stays available for manual runs.
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

/** Daily (after /api/cron/rent posts charges): rent reminders, overdue notices and the landlord digest. */
async function run(req: Request) {
  // Fail closed: this endpoint sends billed SMS/WhatsApp.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prcontract.online";
  const summary = await runDailyMessages(supabase, todayPR(), appUrl).catch((e) => ({
    leases: 0, sent: 0, skipped: 0, failed: 0, duplicates: 0, digests: 0, errors: [String(e)],
  }));
  await supabase.from("cron_runs").insert({ job: "messages", started_at: startedAt, finished_at: new Date().toISOString(), ok: summary.errors.length === 0, summary });
  if (summary.errors.length) console.error(JSON.stringify({ level: "error", msg: "cron messages finished with errors", ...summary }));
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}
