import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black">
      <MeshGradientBg />
      <div className="orb orb-blue" />
      <div className="orb orb-indigo" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
