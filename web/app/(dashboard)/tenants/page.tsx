import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
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
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Directory
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Tenants
          </h1>
        </div>
        <AddTenantModal userId={user.id} />
      </div>

      {/* ── Empty state ── */}
      {all.length === 0 ? (
        <div
          className="surface-card p-12 flex flex-col items-center gap-4 text-center animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface-container)" }}
          >
            <Users className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No tenants yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Add tenants to assign them to contracts
            </p>
          </div>
        </div>
      ) : (
        /* ── Tenant list ── */
        <div
          className="surface-card p-2 animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          {all.map((t, i) => (
            <div
              key={t.id}
              className="row-tonal flex items-center gap-4 p-4 mx-1 my-1"
              style={{ animationDelay: `${i * 0.03}s`, animationFillMode: "both" }}
            >
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #005bc2, #007aff)" }}
              >
                {t.full_name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t.full_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {[t.email, t.phone].filter(Boolean).join(" · ") || "No contact info"}
                </p>
              </div>

              {/* Meta — desktop only */}
              <div className="hidden md:flex items-center gap-6 shrink-0">
                {t.license_number && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      License
                    </p>
                    <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {t.license_number}
                    </p>
                  </div>
                )}
                {t.current_address && (
                  <div className="text-right max-w-[200px]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Address
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {t.current_address}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
