import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAlerts } from "@/lib/alerts";
import { AppShell } from "@/components/shell/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, alerts, cookieStore] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    getAlerts(supabase),
    cookies(),
  ]);

  return (
    <AppShell
      email={user.email ?? ""}
      plan={profile?.plan ?? "free"}
      alerts={alerts}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </AppShell>
  );
}
