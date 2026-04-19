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

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-16 md:pb-0">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
