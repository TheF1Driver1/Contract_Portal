"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  label: string;
  income: number;
  expenses: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  return (
    <div
      className="glass rounded-xl px-4 py-3 space-y-1"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ExpenseIncomeChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(120,135,160,0.6)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "rgba(120,135,160,0.7)", paddingTop: 8 }}
          />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
