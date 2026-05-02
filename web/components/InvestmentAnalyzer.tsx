"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { calcMetrics, STATE_TAX_RATES, crimEffectiveAnnualPct } from "@/lib/investment";
import type { InvestmentAnalysis, InvestmentMetrics, WatchlistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

interface Props {
  item: WatchlistItem;
  existing: InvestmentAnalysis | null;
}

type FormState = Omit<InvestmentAnalysis, "id" | "owner_id" | "watchlist_id" | "created_at" | "updated_at">;

function defaultForm(item: WatchlistItem, existing: InvestmentAnalysis | null): FormState {
  if (existing) {
    return {
      purchase_price:       existing.purchase_price,
      down_payment_pct:     existing.down_payment_pct,
      closing_cost_pct:     existing.closing_cost_pct,
      mortgage_rate_pct:    existing.mortgage_rate_pct,
      loan_term_years:      existing.loan_term_years,
      annual_tax_pct:       existing.annual_tax_pct,
      annual_insurance_pct: existing.annual_insurance_pct,
      maintenance_pct:      existing.maintenance_pct,
      monthly_hoa:          existing.monthly_hoa,
      monthly_utilities:    existing.monthly_utilities,
      estimated_rent:       existing.estimated_rent,
      vacancy_rate_pct:     existing.vacancy_rate_pct,
    };
  }
  // PR uses CRIM rates (fetched async in component); fall back to 1.1 placeholder until loaded
  const stateTax = item.state && item.state.toUpperCase() !== "PR"
    ? (STATE_TAX_RATES[item.state.toUpperCase()] ?? 1.1)
    : 1.1;
  return {
    purchase_price:       item.price ?? 0,
    down_payment_pct:     20,
    closing_cost_pct:     3,
    mortgage_rate_pct:    7.0,
    loan_term_years:      30,
    annual_tax_pct:       stateTax,
    annual_insurance_pct: 0.8,
    maintenance_pct:      1.0,
    monthly_hoa:          0,
    monthly_utilities:    150,
    estimated_rent:       null,
    vacancy_rate_pct:     5,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  prefix,
  step = "1",
  min = "0",
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          min={min}
          value={value ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn("input-tonal w-full", prefix && "pl-7", suffix && "pr-10")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "neutral" | "positive" | "negative" | "warn";
}) {
  const color =
    emphasis === "positive" ? "#30d158"
    : emphasis === "negative" ? "#ff453a"
    : emphasis === "warn"    ? "#ffd60a"
    : "var(--text-primary)";

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px my-1" style={{ background: "var(--surface-container)" }} />;
}

function ReturnBadge({ value, thresholdGood, thresholdWarn }: { value: number; thresholdGood: number; thresholdWarn: number }) {
  const cls = value >= thresholdGood ? "pill-active" : value >= thresholdWarn ? "pill-draft" : "pill-expired";
  return <span className={cls}>{pct(value)}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function InvestmentAnalyzer({ item, existing }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => defaultForm(item, existing));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [crimInfo, setCrimInfo] = useState<{ municipality: string; inmueble_rate: number } | null>(null);

  useEffect(() => {
    if (item.state?.toUpperCase() !== "PR" || !item.city || existing) return;
    fetch(`/api/crim-rate?city=${encodeURIComponent(item.city)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setCrimInfo({ municipality: data.municipality, inmueble_rate: data.inmueble_rate });
        setForm((f) => ({ ...f, annual_tax_pct: crimEffectiveAnnualPct(data.inmueble_rate) }));
      })
      .catch(() => null);
  }, [item.city, item.state, existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  const metrics: InvestmentMetrics = useMemo(() => {
    const analysis = {
      ...form,
      id: "",
      owner_id: "",
      watchlist_id: item.id,
      created_at: "",
      updated_at: "",
    } as InvestmentAnalysis;
    return calcMetrics(analysis, item.state);
  }, [form, item.state, item.id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/investment/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const cashFlowPos = metrics.monthly_cash_flow >= 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="animate-slide-up">
        <Link
          href="/watchlist"
          className="flex items-center gap-1.5 text-xs font-medium mb-4 hover:opacity-70 transition-opacity"
          style={{ color: "#007aff" }}
        >
          <ArrowLeft className="h-3 w-3" />
          Watchlist
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Investment Analysis
        </p>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          {item.street ?? "Property"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {[item.city, item.state].filter(Boolean).join(", ")}
          {item.price ? ` · Listed at ${fmt(item.price)}` : ""}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: "0.08s", animationFillMode: "both" }}>

        {/* ── LEFT: Inputs ── */}
        <div className="space-y-4">

          {/* Acquisition */}
          <div className="surface-card p-5">
            <SectionLabel>Acquisition</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <NumberField label="Purchase Price" value={form.purchase_price} onChange={(v) => set("purchase_price", v)} prefix="$" step="1000" />
              </div>
              <NumberField label="Down Payment" value={form.down_payment_pct} onChange={(v) => set("down_payment_pct", v)} suffix="%" step="0.5" />
              <NumberField label="Closing Costs" value={form.closing_cost_pct} onChange={(v) => set("closing_cost_pct", v)} suffix="%" step="0.1" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl p-3" style={{ background: "var(--surface-low)" }}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Upfront Required</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(metrics.total_upfront)}</span>
            </div>
          </div>

          {/* Financing */}
          <div className="surface-card p-5">
            <SectionLabel>Financing</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Mortgage Rate" value={form.mortgage_rate_pct} onChange={(v) => set("mortgage_rate_pct", v)} suffix="%" step="0.05" />
              <div>
                <FieldLabel>Loan Term</FieldLabel>
                <select
                  className="input-tonal w-full"
                  value={form.loan_term_years}
                  onChange={(e) => set("loan_term_years", parseInt(e.target.value))}
                >
                  <option value={10}>10 years</option>
                  <option value={15}>15 years</option>
                  <option value={20}>20 years</option>
                  <option value={30}>30 years</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl p-3" style={{ background: "var(--surface-low)" }}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Monthly Mortgage (P&I)</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(metrics.monthly_mortgage)}</span>
            </div>
          </div>

          {/* Operating Expenses */}
          <div className="surface-card p-5">
            <SectionLabel>Operating Expenses (Annual %)</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={
                  crimInfo
                    ? `Property Tax (CRIM — ${crimInfo.municipality} ${crimInfo.inmueble_rate.toFixed(2)}%)`
                    : item.state
                      ? `Property Tax (${item.state.toUpperCase()} avg: ${STATE_TAX_RATES[item.state.toUpperCase()]?.toFixed(2) ?? "—"}%)`
                      : "Property Tax"
                }
                value={form.annual_tax_pct}
                onChange={(v) => set("annual_tax_pct", v)}
                suffix="%"
                step="0.01"
              />
              <NumberField label="Insurance" value={form.annual_insurance_pct} onChange={(v) => set("annual_insurance_pct", v)} suffix="%" step="0.1" />
              <NumberField label="Maintenance Reserve" value={form.maintenance_pct} onChange={(v) => set("maintenance_pct", v)} suffix="%" step="0.1" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField label="HOA ($/mo)" value={form.monthly_hoa} onChange={(v) => set("monthly_hoa", v)} prefix="$" />
              <NumberField label="Utilities ($/mo)" value={form.monthly_utilities} onChange={(v) => set("monthly_utilities", v)} prefix="$" />
            </div>
          </div>

          {/* Income Assumptions */}
          <div className="surface-card p-5">
            <SectionLabel>Income Assumptions</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <NumberField label="Estimated Monthly Rent" value={form.estimated_rent ?? 0} onChange={(v) => set("estimated_rent", v)} prefix="$" step="50" />
              </div>
              <NumberField label="Vacancy Rate" value={form.vacancy_rate_pct} onChange={(v) => set("vacancy_rate_pct", v)} suffix="%" step="0.5" />
              <div className="flex items-end pb-1">
                <div className="rounded-xl p-3 w-full" style={{ background: "var(--surface-low)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Effective Rent</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {fmt(metrics.effective_monthly_rent)}/mo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Metrics ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">

          {/* Cash Flow headline */}
          <div
            className="surface-card p-5"
            style={{ borderLeft: `3px solid ${cashFlowPos ? "#30d158" : "#ff453a"}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Monthly Cash Flow
              </p>
              {cashFlowPos
                ? <TrendingUp className="h-4 w-4" style={{ color: "#30d158" }} />
                : <TrendingDown className="h-4 w-4" style={{ color: "#ff453a" }} />
              }
            </div>
            <p
              className="text-4xl font-bold tabular-nums"
              style={{ color: cashFlowPos ? "#30d158" : "#ff453a", letterSpacing: "-0.03em" }}
            >
              {cashFlowPos ? "+" : ""}{fmt(metrics.monthly_cash_flow)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {cashFlowPos ? "+" : ""}{fmt(metrics.annual_cash_flow)}/yr
            </p>
          </div>

          {/* Monthly Breakdown */}
          <div className="surface-card p-5">
            <SectionLabel>Monthly Breakdown</SectionLabel>
            <MetricRow label="Mortgage (P&I)"      value={fmt(metrics.monthly_mortgage)} />
            <MetricRow label="Property Tax"         value={fmt(metrics.monthly_tax)} />
            <MetricRow label="Insurance"            value={fmt(metrics.monthly_insurance)} />
            <MetricRow label="Maintenance"          value={fmt(metrics.monthly_maintenance)} />
            <MetricRow label="HOA"                  value={fmt(metrics.monthly_hoa)} />
            <MetricRow label="Utilities"            value={fmt(metrics.monthly_utilities)} />
            <Divider />
            <MetricRow label="Total Expenses"       value={fmt(metrics.total_monthly_expenses)} emphasis="negative" />
            <MetricRow label="Effective Rent"       value={fmt(metrics.effective_monthly_rent)} emphasis="positive" />
            <Divider />
            <MetricRow
              label="Net Cash Flow"
              value={`${cashFlowPos ? "+" : ""}${fmt(metrics.monthly_cash_flow)}`}
              emphasis={cashFlowPos ? "positive" : "negative"}
            />
          </div>

          {/* Returns */}
          <div className="surface-card p-5">
            <SectionLabel>Return Metrics</SectionLabel>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Cap Rate</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>NOI ÷ Purchase Price</p>
                </div>
                <ReturnBadge value={metrics.cap_rate} thresholdGood={6} thresholdWarn={4} />
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Cash-on-Cash Return</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Annual Cash Flow ÷ Upfront</p>
                </div>
                <ReturnBadge value={metrics.cash_on_cash} thresholdGood={8} thresholdWarn={4} />
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Gross Rent Multiplier</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Price ÷ Annual Rent (lower = better)</p>
                </div>
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {metrics.gross_rent_multiplier > 0 ? `${metrics.gross_rent_multiplier.toFixed(1)}×` : "—"}
                </span>
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Break-even Rent</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Min rent to cover all expenses</p>
                </div>
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmt(metrics.break_even_rent)}/mo
                </span>
              </div>
            </div>
          </div>

          {/* Upfront summary */}
          <div className="surface-card p-5">
            <SectionLabel>Upfront Investment</SectionLabel>
            <MetricRow label="Down Payment"   value={fmt(metrics.down_payment)} />
            <MetricRow label="Closing Costs"  value={fmt(metrics.closing_costs)} />
            <MetricRow label="Loan Amount"    value={fmt(metrics.loan_amount)} />
            <Divider />
            <MetricRow label="Cash Required"  value={fmt(metrics.total_upfront)} emphasis="neutral" />
          </div>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              "btn-primary-gradient w-full justify-center flex items-center gap-2",
              saved && "opacity-80"
            )}
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            {saved ? "Saved!" : "Save Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}
