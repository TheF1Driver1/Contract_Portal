import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen w-full bg-background">{children}</div>;
}
