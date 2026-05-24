import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { canExportScheduleE } from "@/lib/subscription";
import type { SubscriptionPlan } from "@/lib/types";
import ScheduleEClient from "./ScheduleEClient";

export const dynamic = "force-dynamic";

export default async function ScheduleEPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "free") as SubscriptionPlan;

  return <ScheduleEClient plan={plan} canExport={canExportScheduleE(plan)} />;
}
