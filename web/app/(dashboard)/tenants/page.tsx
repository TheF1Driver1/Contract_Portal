import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import type { Tenant } from "@/lib/types";
import AddTenantModal from "./AddTenantModal";

export default async function TenantsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .eq("owner_id", user.id)
    .order("full_name");

  const all = (tenants ?? []) as Tenant[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">{all.length} tenants</p>
        </div>
        <AddTenantModal userId={user.id} />
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No tenants yet</p>
          <p className="text-sm text-muted-foreground">Add tenants to assign them to contracts.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">License #</th>
                  <th className="px-4 py-3">Address</th>
                </tr>
              </thead>
              <tbody>
                {all.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {t.full_name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium">{t.full_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.license_number ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.current_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {all.map((t) => (
              <div key={t.id} className="bg-card rounded-lg p-4 border">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {t.full_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-sm">{t.full_name}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t.email ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{t.phone ?? "—"}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
