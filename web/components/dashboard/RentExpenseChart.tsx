"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RentExpensePoint = {
  key: string;
  label: string;
  fullLabel: string;
  rent: number;
  expenses: number;
};

const AXIS_TICK = { fill: "var(--subtle-foreground)", fontSize: 12 };

/** Expected rent vs expenses per month. Loaded lazily via LazyCharts (browser only). */
export default function RentExpenseChart({ data }: { data: RentExpensePoint[] }) {
  const t = useTranslations("dashboard.chart");
  const f = useFormatter();

  const compact = (v: number) =>
    f.number(v, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

  function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
    const point = active ? (payload?.[0]?.payload as RentExpensePoint | undefined) : undefined;
    if (!point) return null;
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md">
        <p className="mb-1 font-medium text-foreground">{point.fullLabel}</p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
          {t("rent")}: <span className="tabular font-medium text-foreground">{f.number(point.rent, "money")}</span>
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-chart-3" aria-hidden />
          {t("expenses")}: <span className="tabular font-medium text-foreground">{f.number(point.expenses, "money")}</span>
        </p>
      </div>
    );
  }

  return (
    <div aria-hidden className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
          <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} />} cursor={{ fill: "var(--surface-hover)" }} />
          <Bar dataKey="rent" name={t("rent")} fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenses" name={t("expenses")} fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
