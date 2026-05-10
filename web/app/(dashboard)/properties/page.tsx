import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import type { Property } from "@/lib/types";
import AddPropertyModal from "./AddPropertyModal";
import EditPropertyModal from "./EditPropertyModal";
import CoOwnersModal from "./CoOwnersModal";
import PropertyMap from "@/components/PropertyMap";

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: properties }, { data: coOwnedRows }] = await Promise.all([
    supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    supabase
      .from("property_co_owners")
      .select("ownership_pct, property:properties(*)")
      .eq("co_owner_id", user.id)
      .eq("status", "accepted"),
  ]);

  const ownedProperties = (properties ?? []) as Property[];
  const coOwnedProperties = ((coOwnedRows ?? []) as any[]).map((row) => ({
    ...(row.property as Property),
    _ownership_pct: row.ownership_pct as number,
    _is_co_owned: true,
  }));

  const all = [
    ...ownedProperties.map((p) => ({ ...p, _ownership_pct: 100, _is_co_owned: false })),
    ...coOwnedProperties,
  ];
  const mapped = all.filter(
    (p) => p.latitude && p.longitude
  ) as (Property & { latitude: number; longitude: number; _ownership_pct: number; _is_co_owned: boolean })[];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Portfolio
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Properties
          </h1>
        </div>
        <AddPropertyModal userId={user.id} />
      </div>

      {/* ── Map ── */}
      {mapped.length > 0 && (
        <div
          className="animate-slide-up"
          style={{ animationDelay: "0.06s", animationFillMode: "both" }}
        >
          <PropertyMap properties={mapped} allProperties={all} />
        </div>
      )}

      {/* ── Empty state ── */}
      {all.length === 0 ? (
        <div
          className="surface-card p-12 flex flex-col items-center gap-4 text-center animate-slide-up"
          style={{ animationDelay: "0.08s", animationFillMode: "both" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface-container)" }}
          >
            <Building2 className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No properties yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Add a property to start creating contracts
            </p>
          </div>
        </div>
      ) : (
        /* ── Property grid ── */
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up"
          style={{ animationDelay: "0.08s", animationFillMode: "both" }}
        >
          {all.map((p, i) => (
            <div
              key={p.id}
              className="surface-card p-5"
              style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: (p as any)._is_co_owned ? "rgba(139,92,246,0.10)" : "rgba(0,122,255,0.10)" }}
                >
                  <Building2 className="h-5 w-5" style={{ color: (p as any)._is_co_owned ? "#8b5cf6" : "#007aff" }} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </p>
                    {(p as any)._ownership_pct < 100 && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}
                      >
                        {(p as any)._ownership_pct}%
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {p.address}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {p.city}, {p.state}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {p.unit_count} unit{p.unit_count !== 1 ? "s" : ""}
                    {p.bathroom_count ? ` · ${p.bathroom_count} bath${p.bathroom_count !== 1 ? "s" : ""}` : ""}
                    {p.parking_available ? " · Parking" : ""}
                  </p>
                </div>
                <div className="shrink-0 flex gap-1.5">
                  {!(p as any)._is_co_owned && <CoOwnersModal property={p} />}
                  {!(p as any)._is_co_owned && <EditPropertyModal property={p} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
