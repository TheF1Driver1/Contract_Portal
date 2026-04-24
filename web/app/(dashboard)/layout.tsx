import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden flex-col md:flex-row" style={{ background: "var(--surface-base)" }}>
      {/* Ambient background orbs */}
      <div className="orb orb-blue" />
      <div className="orb orb-indigo" />
      <div className="orb orb-teal" />

      <Sidebar userEmail={user.email ?? ""} />

      <main
        className="relative z-10 flex-1 overflow-y-auto pt-14 md:pt-0 pb-16 md:pb-0"
        style={{ background: "transparent" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
