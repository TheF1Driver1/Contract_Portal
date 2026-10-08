"use client";

import { useId, useMemo, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save, TrendingUp, TrendingDown, ArrowLeft, Check, Minus } from "lucide-react";
import { calcMetrics, STATE_TAX_RATES, crimEffectiveAnnualPct } from "@/lib/investment";
import type { InvestmentAnalysis, InvestmentMetrics, WatchlistItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/PageHeader";
import { LabsTitle } from "@/components/market/LabsTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const id = useId();
  return (
    <section className="rounded-xl border bg-surface p-4 md:p-5" aria-labelledby={id}>
      <h2 id={id} className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  suffix,
  prefix,
  step = "1",
  min = "0",
  wide,
}: {
  label: string;
  hint?: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: string;
  min?: string;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn("tabular", prefix && "pl-7", suffix && "pr-10")}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MetricRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <dt className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</dt>
      <dd className={cn("tabular", strong ? "font-semibold text-foreground" : "text-foreground")}>{value}</dd>
    </div>
  );
}

type Tone = "good" | "warn" | "bad";
const TONE: Record<Tone, { cls: string; Icon: typeof Check }> = {
  good: { cls: "bg-success-soft text-success", Icon: TrendingUp },
  warn: { cls: "bg-warning-soft text-warning", Icon: Minus },
  bad: { cls: "bg-danger-soft text-danger", Icon: TrendingDown },
};

function Kpi({
  label,
  value,
  sub,
  tone,
  toneLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  toneLabel?: string;
}) {
  const T = tone ? TONE[tone] : null;
  return (
    <div className="rounded-xl border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {T && toneLabel && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", T.cls)}>
            <T.Icon className="size-3" aria-hidden />
            {toneLabel}
          </span>
        )}
        {sub && <span className="tabular text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const rate = (v: number, good: number, warn: number): Tone => (v >= good ? "good" : v >= warn ? "warn" : "bad");

// ── Main component ─────────────────────────────────────────────────────────

export default function InvestmentAnalyzer({ item, existing }: Props) {
  const t = useTranslations("market.analyzer");
  const tm = useTranslations("market");
  const f = useFormatter();
  const fmt = (n: number) => f.number(n, "money");
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
      toast.success(t("savedToast"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const cashFlowPos = metrics.monthly_cash_flow >= 0;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
  const stateKey = item.state?.toUpperCase();
  const taxHint = crimInfo
    ? t("taxHintCrim", { municipality: crimInfo.municipality, rate: crimInfo.inmueble_rate.toFixed(2) })
    : stateKey && STATE_TAX_RATES[stateKey] != null
      ? t("taxHintState", { state: stateKey, rate: STATE_TAX_RATES[stateKey].toFixed(2) })
      : undefined;
  const toneLabel = (tone: Tone) => t(`tone.${tone}`);
  const capTone = rate(metrics.cap_rate, 6, 4);
  const cocTone = rate(metrics.cash_on_cash, 8, 4);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 min-h-10 text-muted-foreground">
          <Link href="/watchlist">
            <ArrowLeft aria-hidden />
            {tm("watchlist.title")}
          </Link>
        </Button>
        <PageHeader
          title={<LabsTitle title={item.street ?? t("property")} labs={tm("labs")} />}
          description={
            <>
              {t("heading")}
              {" · "}
              {[item.city, item.state].filter(Boolean).join(", ")}
              {item.price ? <> · <span className="tabular">{t("listedAt", { price: fmt(item.price) })}</span></> : null}
            </>
          }
          actions={
            <Button onClick={save} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : saved ? <Check aria-hidden /> : <Save aria-hidden />}
              {saved ? t("saved") : t("save")}
            </Button>
          }
        />
        <p className="-mt-3 text-xs text-subtle-foreground">{t("disclaimer")}</p>
      </div>

      {/* KPI row */}
      <section aria-label={t("results")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={t("kpi.cashFlow")}
          value={signed(metrics.monthly_cash_flow)}
          sub={t("perYear", { amount: signed(metrics.annual_cash_flow) })}
          tone={cashFlowPos ? "good" : "bad"}
          toneLabel={cashFlowPos ? t("positive") : t("negative")}
        />
        <Kpi
          label={t("kpi.capRate")}
          value={pct(metrics.cap_rate)}
          sub={t("kpi.capRateHint")}
          tone={capTone}
          toneLabel={toneLabel(capTone)}
        />
        <Kpi
          label={t("kpi.coc")}
          value={pct(metrics.cash_on_cash)}
          sub={t("kpi.cocHint")}
          tone={cocTone}
          toneLabel={toneLabel(cocTone)}
        />
        <Kpi
          label={t("kpi.breakEven")}
          value={`${fmt(metrics.break_even_rent)}${t("perMonth")}`}
          sub={metrics.gross_rent_multiplier > 0
            ? t("kpi.grm", { value: metrics.gross_rent_multiplier.toFixed(1) })
            : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── Inputs ── */}
        <div className="space-y-4">
          <Group title={t("groups.acquisition")} footer={<Summary label={t("totalUpfront")} value={fmt(metrics.total_upfront)} />}>
            <NumberField wide label={t("fields.purchasePrice")} value={form.purchase_price} onChange={(v) => set("purchase_price", v)} prefix="$" step="1000" />
            <NumberField label={t("fields.downPayment")} value={form.down_payment_pct} onChange={(v) => set("down_payment_pct", v)} suffix="%" step="0.5" />
            <NumberField label={t("fields.closingCosts")} value={form.closing_cost_pct} onChange={(v) => set("closing_cost_pct", v)} suffix="%" step="0.1" />
          </Group>

          <Group title={t("groups.financing")} footer={<Summary label={t("monthlyMortgage")} value={fmt(metrics.monthly_mortgage)} />}>
            <NumberField label={t("fields.mortgageRate")} value={form.mortgage_rate_pct} onChange={(v) => set("mortgage_rate_pct", v)} suffix="%" step="0.05" />
            <div className="space-y-1.5">
              <Label htmlFor="loan-term">{t("fields.loanTerm")}</Label>
              <Select value={String(form.loan_term_years)} onValueChange={(v) => set("loan_term_years", parseInt(v))}>
                <SelectTrigger id="loan-term" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 30].map((y) => (
                    <SelectItem key={y} value={String(y)}>{t("years", { count: y })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Group>

          <Group title={t("groups.expenses")}>
            <NumberField
              label={t("fields.propertyTax")}
              hint={taxHint}
              value={form.annual_tax_pct}
              onChange={(v) => set("annual_tax_pct", v)}
              suffix="%"
              step="0.01"
            />
            <NumberField label={t("fields.insurance")} value={form.annual_insurance_pct} onChange={(v) => set("annual_insurance_pct", v)} suffix="%" step="0.1" />
            <NumberField label={t("fields.maintenance")} value={form.maintenance_pct} onChange={(v) => set("maintenance_pct", v)} suffix="%" step="0.1" />
            <NumberField label={t("fields.hoa")} value={form.monthly_hoa} onChange={(v) => set("monthly_hoa", v)} prefix="$" />
            <NumberField label={t("fields.utilities")} value={form.monthly_utilities} onChange={(v) => set("monthly_utilities", v)} prefix="$" />
          </Group>

          <Group
            title={t("groups.income")}
            footer={<Summary label={t("effectiveRent")} value={`${fmt(metrics.effective_monthly_rent)}${t("perMonth")}`} />}
          >
            <NumberField wide label={t("fields.rent")} value={form.estimated_rent ?? 0} onChange={(v) => set("estimated_rent", v)} prefix="$" step="50" />
            <NumberField label={t("fields.vacancy")} value={form.vacancy_rate_pct} onChange={(v) => set("vacancy_rate_pct", v)} suffix="%" step="0.5" />
          </Group>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="breakdown-title">
            <h2 id="breakdown-title" className="mb-2 text-base font-semibold text-foreground">{t("breakdown.title")}</h2>
            <dl>
              <MetricRow label={t("breakdown.mortgage")} value={fmt(metrics.monthly_mortgage)} />
              <MetricRow label={t("breakdown.tax")} value={fmt(metrics.monthly_tax)} />
              <MetricRow label={t("breakdown.insurance")} value={fmt(metrics.monthly_insurance)} />
              <MetricRow label={t("breakdown.maintenance")} value={fmt(metrics.monthly_maintenance)} />
              <MetricRow label={t("breakdown.hoa")} value={fmt(metrics.monthly_hoa)} />
              <MetricRow label={t("breakdown.utilities")} value={fmt(metrics.monthly_utilities)} />
              <Separator className="my-2" />
              <MetricRow label={t("breakdown.totalExpenses")} value={fmt(metrics.total_monthly_expenses)} strong />
              <MetricRow label={t("effectiveRent")} value={fmt(metrics.effective_monthly_rent)} strong />
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-1.5 text-sm">
                <dt className="font-medium text-foreground">{t("breakdown.net")}</dt>
                <dd className={cn("tabular inline-flex items-center gap-1 font-semibold", cashFlowPos ? "text-success" : "text-danger")}>
                  {cashFlowPos ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
                  {signed(metrics.monthly_cash_flow)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="upfront-title">
            <h2 id="upfront-title" className="mb-2 text-base font-semibold text-foreground">{t("upfront.title")}</h2>
            <dl>
              <MetricRow label={t("upfront.downPayment")} value={fmt(metrics.down_payment)} />
              <MetricRow label={t("upfront.closingCosts")} value={fmt(metrics.closing_costs)} />
              <MetricRow label={t("upfront.loanAmount")} value={fmt(metrics.loan_amount)} />
              <Separator className="my-2" />
              <MetricRow label={t("upfront.cashRequired")} value={fmt(metrics.total_upfront)} strong />
            </dl>
          </section>

          <Button onClick={save} disabled={saving} variant="outline" className="min-h-10 w-full">
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : saved ? <Check aria-hidden /> : <Save aria-hidden />}
            {saved ? t("saved") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
