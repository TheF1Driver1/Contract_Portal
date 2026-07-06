import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Receipt, TrendingDown, FileCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PropertyExpense, Property } from "@/lib/types";
import AddExpenseModal from "./AddExpenseModal";
import DeleteExpenseButton from "./DeleteExpenseButton";
import EditExpenseButton from "./EditExpenseButton";

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  utilities: "Utilities",
  insurance: "Insurance",
  taxes: "Taxes",
  hoa: "HOA",
  repairs: "Repairs",
  management: "Management",
  advertising: "Advertising",
  mortgage: "Mortgage",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  maintenance: "#f59e0b",
  utilities: "#06b6d4",
  insurance: "#8b5cf6",
  taxes: "#ef4444",
  hoa: "#ec4899",
  repairs: "#f97316",
  management: "#10b981",
  advertising: "#3b82f6",
  mortgage: "#6366f1",
  other: "#6b7280",
};

interface PageProps {
  searchParams: { property_id?: string; year?: string; category?: string };
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const year = searchParams.year ?? new Date().getFullYear().toString();
  const property_id = searchParams.property_id;
  const category = searchParams.category;

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("name");

  let query = supabase
    .from("property_expenses")
    .select("*, property:properties(id,name)")
    .eq("user_id", user.id)
    .gte("expense_date", `${year}-01-01`)
    .lte("expense_date", `${year}-12-31`)
    .order("expense_date", { ascending: false });

  if (property_id) query = query.eq("property_id", property_id);
  if (category) query = query.eq("category", category);

  const { data: expenses } = await query;
  const all = (expenses ?? []) as (PropertyExpense & { property: { id: string; name: string } | null })[];

  const totalExpenses = all.reduce((s, e) => s + e.amount, 0);
  const taxDeductible = all.filter((e) => e.is_tax_deductible).reduce((s, e) => s + e.amount, 0);

  const byCategory = Object.entries(
    all.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a);

  const allProps = (properties ?? []) as Pick<Property, "id" | "name">[];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Finance
          </p>
          <h1 className="font-display text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-[#f2efe6] to-[#a3a196]" style={{ letterSpacing: "-0.03em" }}>
            Expenses
          </h1>
        </div>
        <AddExpenseModal properties={allProps} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: "0.06s", animationFillMode: "both" }}>
        <div className="surface-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: "linear-gradient(135deg,#b91c1c,#ef4444)", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" }}>
            <TrendingDown className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-3xl font-bold" style={{ color: "#ef4444", letterSpacing: "-0.03em" }}>{formatCurrency(totalExpenses)}</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Total Expenses</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{year} YTD</p>
        </div>
        <div className="surface-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 4px 14px rgba(20,184,166,0.35)" }}>
            <FileCheck className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-3xl font-bold" style={{ color: "#14b8a6", letterSpacing: "-0.03em" }}>{formatCurrency(taxDeductible)}</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Tax Deductible</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{year}</p>
        </div>
        <div className="surface-card p-5 col-span-2 lg:col-span-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", boxShadow: "0 4px 14px rgba(139,92,246,0.35)" }}>
            <Receipt className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{all.length}</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Transactions</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{year}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: "0.10s", animationFillMode: "both" }}>
        {/* Year filter */}
        <form className="flex gap-2 flex-wrap">
          {years.map((y) => (
            <a
              key={y}
              href={`/expenses?year=${y}${property_id ? `&property_id=${property_id}` : ""}${category ? `&category=${category}` : ""}`}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: y === year ? "rgba(16, 185, 129,0.18)" : "rgba(255,255,255,0.06)",
                color: y === year ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${y === year ? "rgba(16, 185, 129,0.30)" : "transparent"}`,
              }}
            >
              {y}
            </a>
          ))}
          {allProps.length > 1 && (
            <>
              <span className="w-px h-6 self-center mx-1" style={{ background: "rgba(255,255,255,0.10)" }} />
              <a
                href={`/expenses?year=${year}${category ? `&category=${category}` : ""}`}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: !property_id ? "rgba(16, 185, 129,0.18)" : "rgba(255,255,255,0.06)",
                  color: !property_id ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${!property_id ? "rgba(16, 185, 129,0.30)" : "transparent"}`,
                }}
              >
                All Properties
              </a>
              {allProps.map((p) => (
                <a
                  key={p.id}
                  href={`/expenses?year=${year}&property_id=${p.id}${category ? `&category=${category}` : ""}`}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: property_id === p.id ? "rgba(16, 185, 129,0.18)" : "rgba(255,255,255,0.06)",
                    color: property_id === p.id ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${property_id === p.id ? "rgba(16, 185, 129,0.30)" : "transparent"}`,
                  }}
                >
                  {p.name}
                </a>
              ))}
            </>
          )}
        </form>
      </div>

      {/* Category breakdown + list */}
      <div className="grid gap-5 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: "0.14s", animationFillMode: "both" }}>
        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div className="surface-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              By Category
            </p>
            <div className="space-y-3">
              {byCategory.map(([cat, total]) => (
                <a
                  key={cat}
                  href={`/expenses?year=${year}${property_id ? `&property_id=${property_id}` : ""}&category=${cat}`}
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLORS[cat] ?? "#6b7280" }}
                    />
                    <span className="text-xs font-medium truncate group-hover:opacity-70 transition-opacity" style={{ color: "var(--text-secondary)" }}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  </div>
                  <span className="text-xs font-semibold ml-2 shrink-0" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(total)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Expense rows */}
        <div className={byCategory.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          {all.length === 0 ? (
            <div className="surface-card p-12 flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--surface-container)" }}>
                <Receipt className="h-6 w-6" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No expenses yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Track property expenses for tax deductions and cashflow</p>
              </div>
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <div className="space-y-0 divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {all.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: CATEGORY_COLORS[e.category] ?? "#6b7280" }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {CATEGORY_LABELS[e.category] ?? e.category}
                          </p>
                          {e.is_tax_deductible && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6" }}>
                              Deductible
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {e.property?.name}
                          {e.vendor ? ` · ${e.vendor}` : ""}
                          {e.description ? ` · ${e.description}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {formatCurrency(e.amount)}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <EditExpenseButton expense={e} properties={allProps} />
                      <DeleteExpenseButton id={e.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
