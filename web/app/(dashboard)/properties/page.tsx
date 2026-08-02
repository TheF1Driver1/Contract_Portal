import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import AddPropertyModal from "./AddPropertyModal";
import EditPropertyModal from "./EditPropertyModal";
import PropertyMap from "@/components/PropertyMap";

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const thisYear = new Date().getFullYear().toString();

  const [{ data: properties }, { data: activeContracts }, { data: expenses }] = await Promise.all([
    supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    supabase.from("contracts").select("property_id, rent_amount").eq("owner_id", user.id).eq("status", "signed"),
    supabase
      .from("property_expenses")
      .select("property_id, amount")
      .eq("user_id", user.id)
      .gte("expense_date", `${thisYear}-01-01`)
      .lte("expense_date", `${thisYear}-12-31`),
  ]);

  const all = (properties ?? []) as Property[];

  const incomeByProperty: Record<string, number> = {};
  for (const c of activeContracts ?? []) {
    incomeByProperty[c.property_id] = (incomeByProperty[c.property_id] ?? 0) + c.rent_amount * 12;
  }
  const expenseByProperty: Record<string, number> = {};
  for (const e of expenses ?? []) {
    expenseByProperty[e.property_id] = (expenseByProperty[e.property_id] ?? 0) + e.amount;
  }
  const mapped = all.filter(
    (p) => p.latitude && p.longitude
  ) as (Property & { latitude: number; longitude: number })[];

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
            className="font-display text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-[#f2efe6] to-[#a3a196]"
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
          {all.map((p, i) => {
            const ytdExpenses = expenseByProperty[p.id] ?? 0;
            const annualIncome = incomeByProperty[p.id] ?? 0;
            const netCashflow = annualIncome - ytdExpenses;
            return (
              <div
                key={p.id}
                className="surface-card p-5"
                style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(16, 185, 129,0.10)" }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: "#10b981" }} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </p>
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
                    {ytdExpenses > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                          {formatCurrency(ytdExpenses)} expenses
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{
                            background: netCashflow >= 0 ? "rgba(20,184,166,0.12)" : "rgba(239,68,68,0.12)",
                            color: netCashflow >= 0 ? "#14b8a6" : "#ef4444",
                          }}
                        >
                          {netCashflow >= 0 ? "+" : ""}{formatCurrency(netCashflow)} net
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <EditPropertyModal property={p} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
