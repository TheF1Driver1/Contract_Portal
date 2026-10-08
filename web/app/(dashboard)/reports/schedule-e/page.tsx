import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { canExportScheduleE } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types";
import { buildScheduleESummary } from "@/components/reports/schedule-e-data";
import ScheduleEClient from "./ScheduleEClient";

export const dynamic = "force-dynamic";

export default async function ScheduleEPage(props: { searchParams: Promise<{ year?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "free") as SubscriptionPlan;
  const canExport = canExportScheduleE(plan);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = years.includes(requested) ? requested : currentYear;

  const summary = canExport ? await buildScheduleESummary(supabase, user.id, year) : null;

  return <ScheduleEClient plan={plan} canExport={canExport} year={year} years={years} summary={summary} />;
}
