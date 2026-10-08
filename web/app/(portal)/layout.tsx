import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { Toaster } from "@/components/ui/sonner";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh w-full bg-background">
      <PortalHeader />
      {children}
      <Toaster richColors position="top-center" />
    </div>
  );
}
