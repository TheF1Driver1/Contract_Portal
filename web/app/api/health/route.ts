import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Uptime probe: confirms the function runs and the database answers.
export async function GET() {
  const started = Date.now();
  const { error } = await createAdminClient().from("plan_entitlements").select("plan").limit(1);
  const db = error ? (error.code === "42P01" ? "ok (migration 012 pending)" : "error") : "ok";
  const ok = db.startsWith("ok");
  return NextResponse.json(
    { ok, db, ms: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
