import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export default async function PortalPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: invites } = await admin
    .from("tenant_invites")
    .select("contract_id")
    .eq("used_by", user.id)
    .eq("used", true)
    .order("used_at", { ascending: false });

  if (invites && invites.length > 0) {
    redirect(`/portal/sign/${invites[0].contract_id}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Tenant Portal</p>
        <h1 className="mt-3 text-2xl font-bold text-white">No contracts found</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Ask your landlord to send you a signing link.
        </p>
      </div>
    </div>
  );
}
