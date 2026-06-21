import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Building2,
  Users,
  Plus,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";

// ponytail: recharts is ~150kB; lazy-load keeps dashboard first-load JS lean
const chartSkeleton = () => <Skeleton className="h-[200px] w-full" />;
const CashflowChart = dynamic(() => import("@/components/CashflowChart"), { ssr: false, loading: chartSkeleton });
const ExpenseIncomeChart = dynamic(() => import("@/components/ExpenseIncomeChart"), { ssr: false, loading: chartSkeleton });
const MarketStatsWidget = dynamic(() => import("@/components/MarketStatsWidget"), { ssr: false, loading: chartSkeleton });
const RentVsMarketChart = dynamic(() => import("@/components/RentVsMarketChart"), { ssr: false, loading: chartSkeleton });

const STATUS_PILL: Record<string, string> = {
  signed: "pill-active",
  draft: "pill-draft",
  sent: "pill-sent",
  expired: "pill-expired",
};

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const thisYear = new Date().getFullYear().toString();

  const [contractsResult, propertiesResult, tenantsResult, expensesResult, propertiesWithNameResult] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, property:properties(name, address), tenant:tenants(full_name, email)")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id").eq("owner_id", user!.id),
    supabase.from("tenants").select("id").eq("owner_id", user!.id),
    supabase
      .from("property_expenses")
      .select("property_id, amount, is_tax_deductible")
      .eq("user_id", user!.id)
      .gte("expense_date", `${thisYear}-01-01`)
      .lte("expense_date", `${thisYear}-12-31`),
    supabase.from("properties").select("id, name").eq("owner_id", user!.id).order("name"),
  ]);

  const contracts = (contractsResult.data ?? []) as Contract[];
  const propertyCount = propertiesResult.data?.length ?? 0;
  const tenantCount = tenantsResult.data?.length ?? 0;
  const allExpenses = expensesResult.data ?? [];
  const allPropertiesNamed = propertiesWithNameResult.data ?? [];

  const activeContracts = contracts.filter((c) => c.status === "signed");
  const draftContracts = contracts.filter((c) => c.status === "draft");
  const expiringContracts = activeContracts.filter((c) => {
    const days = daysUntil(c.lease_end);
    return days >= 0 && days <= 60;
  });

  const monthlyRevenue = activeContracts.reduce((sum, c) => sum + c.rent_amount, 0);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      income: 0,
    };
  });
  activeContracts.forEach((c) => {
    const start = c.lease_start.slice(0, 7);
    const end = c.lease_end.slice(0, 7);
    months.forEach((m) => {
      if (m.key >= start && m.key <= end) m.income += c.rent_amount;
    });
  });
  const cashflowData = months.map(({ label, income }) => ({ label, income }));

  const taxDeductibleTotal = allExpenses.filter((e) => e.is_tax_deductible).reduce((s, e) => s + e.amount, 0);

  const expenseByProperty: Record<string, number> = {};
  for (const e of allExpenses) {
    expenseByProperty[e.property_id] = (expenseByProperty[e.property_id] ?? 0) + e.amount;
  }
  const incomeByProperty: Record<string, number> = {};
  for (const c of activeContracts) {
    incomeByProperty[c.property_id] = (incomeByProperty[c.property_id] ?? 0) + c.rent_amount * 12;
  }
  const expenseIncomeData = allPropertiesNamed
    .map((p) => ({
      label: p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name,
      income: incomeByProperty[p.id] ?? 0,
      expenses: expenseByProperty[p.id] ?? 0,
    }))
    .filter((d) => d.income > 0 || d.expenses > 0);

  const stats = [
    {
      label: "Monthly Revenue",
      tooltip: "Sum of rent from all active (signed) leases this month.",
      value: formatCurrency(monthlyRevenue),
      sub: `${activeContracts.length} active lease${activeContracts.length !== 1 ? "s" : ""}`,
      icon: TrendingUp,
      iconBg: "linear-gradient(135deg, #0057d9 0%, #007aff 100%)",
      iconColor: "#fff",
      iconGlow: "0 4px 14px rgba(0,122,255,0.45)",
      valueColor: "#007aff",
    },
    {
      label: "Properties",
      tooltip: "Total properties in your portfolio.",
      value: propertyCount,
      sub: "in portfolio",
      icon: Building2,
      iconBg: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
      iconColor: "#fff",
      iconGlow: "0 4px 14px rgba(20,184,166,0.40)",
      valueColor: "var(--text-primary)",
      href: "/properties",
    },
    {
      label: "Tenants",
      tooltip: "Total tenants registered across all contracts.",
      value: tenantCount,
      sub: "registered",
      icon: Users,
      iconBg: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
      iconColor: "#fff",
      iconGlow: "0 4px 14px rgba(139,92,246,0.40)",
      valueColor: "var(--text-primary)",
      href: "/tenants",
    },
    {
      label: "Expiring Soon",
      tooltip: "Active leases ending within the next 60 days.",
      value: expiringContracts.length,
      sub: "within 60 days",
      icon: AlertTriangle,
      iconBg: expiringContracts.length > 0
        ? "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)"
        : "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)",
      iconColor: "#fff",
      iconGlow: expiringContracts.length > 0 ? "0 4px 14px rgba(239,68,68,0.40)" : "none",
      valueColor: expiringContracts.length > 0 ? "#ef4444" : "var(--text-primary)",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="animate-slide-up">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Overview
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Dashboard
          </h1>
        </div>
        <Link
          href="/contracts/new"
          className="btn-primary-gradient flex items-center gap-2 animate-slide-up"
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          <Plus className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, tooltip, value, sub, icon: Icon, iconBg, iconColor, iconGlow, valueColor, href }, i) => {
          const cardClass = `surface-card animate-slide-up${href ? " hover:ring-1 hover:ring-white/10 cursor-pointer transition-all" : ""}`;
          const cardStyle = { animationDelay: `${i * 0.06}s`, animationFillMode: "both" as const };
          const inner = (
            <>
              <div className="flex items-start justify-between mb-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: iconBg, boxShadow: iconGlow }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} strokeWidth={2.5} />
                </div>
                {href && <ArrowRight className="h-3.5 w-3.5 opacity-30" style={{ color: "var(--text-muted)" }} />}
              </div>
              <p
                className="text-3xl font-bold"
                style={{ color: valueColor, letterSpacing: "-0.03em" }}
              >
                {value}
              </p>
              <p className="flex items-center gap-1 text-xs mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
                {label}
                {tooltip && <HelpTooltip text={tooltip} side="bottom" />}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {sub}
              </p>
            </>
          );
          return href ? (
            <Link key={label} href={href} className={cardClass} style={cardStyle}>
              {inner}
            </Link>
          ) : (
            <div key={label} className={cardClass} style={cardStyle}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Expiring Soon */}
        <div
          className="surface-card p-6 animate-slide-up"
          style={{ animationDelay: "0.24s", animationFillMode: "both" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4" style={{ color: "#c45451" }} strokeWidth={2} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Expiring Soon
            </h2>
          </div>

          {expiringContracts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                All clear — no leases expiring within 60 days.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {expiringContracts.map((c) => {
                const days = daysUntil(c.lease_end);
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} className="row-tonal flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {c.tenant?.full_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {c.property?.name}
                      </p>
                    </div>
                    <span className={days <= 30 ? "pill-expired" : "pill-draft"}>{days}d</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Contracts */}
        <div
          className="surface-card p-6 lg:col-span-2 animate-slide-up"
          style={{ animationDelay: "0.30s", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: "var(--text-secondary)" }} strokeWidth={2} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recent Contracts
              </h2>
            </div>
            <Link
              href="/contracts"
              className="flex items-center gap-1 text-xs font-medium hover:opacity-70 transition-opacity"
              style={{ color: "#007aff" }}
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {contracts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl surface-container">
                <FileText className="h-5 w-5" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  No contracts yet
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Create your first lease contract
                </p>
              </div>
              <Link href="/contracts/new" className="btn-primary-gradient flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Contract
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {contracts.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/contracts/${c.id}`} className="row-tonal flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {c.tenant?.full_name ?? "Unknown Tenant"}
                    </p>
                    <p className="truncate text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {c.property?.name} · {formatCurrency(c.rent_amount)}/mo
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3 shrink-0">
                    <p className="text-[10px] whitespace-nowrap hidden sm:block" style={{ color: "var(--text-muted)" }}>
                      {formatDate(c.created_at)}
                    </p>
                    <span className={STATUS_PILL[c.status] ?? "pill-draft"}>{c.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Cashflow Chart ── */}
      {cashflowData.some((m) => m.income > 0) && (
        <div
          className="surface-card p-6 animate-slide-up"
          style={{ animationDelay: "0.36s", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                Cashflow
              </p>
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                Monthly Income
              </h2>
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Last 6 months
            </span>
          </div>
          <CashflowChart data={cashflowData} />
        </div>
      )}

      {/* ── Income vs Expenses ── */}
      {expenseIncomeData.length > 0 && (
        <div
          className="surface-card p-6 animate-slide-up"
          style={{ animationDelay: "0.42s", animationFillMode: "both" }}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                Finance
              </p>
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                Income vs Expenses
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "#14b8a6" }}>
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(taxDeductibleTotal)} deductible
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {thisYear} YTD
              </p>
            </div>
          </div>
          <ExpenseIncomeChart data={expenseIncomeData} />
        </div>
      )}

      {/* ── Market Stats Widget ── */}
      <div className="animate-slide-up" style={{ animationDelay: "0.48s", animationFillMode: "both" }}>
        <MarketStatsWidget />
      </div>

      {/* ── Rent vs Market ── */}
      <div className="animate-slide-up" style={{ animationDelay: "0.48s", animationFillMode: "both" }}>
        <RentVsMarketChart />
      </div>

      {/* ── Pending Drafts ── */}
      {draftContracts.length > 0 && (
        <div
          className="surface-card p-6 animate-slide-up"
          style={{ animationDelay: "0.42s", animationFillMode: "both" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="pill-draft">{draftContracts.length} pending</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Draft Contracts
            </h2>
          </div>
          <div className="space-y-1.5">
            {draftContracts.map((c) => (
              <div key={c.id} className="row-tonal flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.tenant?.full_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {c.property?.name}
                  </p>
                </div>
                <Link
                  href={`/contracts/${c.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: "#007aff" }}
                >
                  Finish
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
