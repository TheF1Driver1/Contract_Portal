import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { postDueCharges, todayPR } from "@/lib/rent/service";
import { reconcileAthPayments } from "@/lib/athmovil/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls with GET; POST stays available for manual runs.
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

/**
 * Daily: post next month's rent (5 days ahead) and late fees per each lease's
 * policy, then finish or close ATH Móvil payments from the last day whose
 * portal tab was closed before they completed.
 */
async function run(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const charges = await postDueCharges(supabase, todayPR()).catch((e) => ({ leases: 0, posted: 0, errors: [String(e)] }));
  const ath = await reconcileAthPayments(supabase).catch((e) => ({ checked: 0, completed: 0, cancelled: 0, errors: [String(e)] }));
  const summary = { ...charges, ath: { checked: ath.checked, completed: ath.completed, cancelled: ath.cancelled }, errors: [...charges.errors, ...ath.errors] };
  await supabase.from("cron_runs").insert({ job: "rent", started_at: startedAt, finished_at: new Date().toISOString(), ok: summary.errors.length === 0, summary });
  if (summary.errors.length) console.error(JSON.stringify({ level: "error", msg: "cron rent finished with errors", ...summary }));
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}
