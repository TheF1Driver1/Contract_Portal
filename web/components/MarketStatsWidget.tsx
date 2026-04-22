"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"

export default function MarketStatsWidget() {
  const [stats, setStats] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/market/stats")
      .then(r => r.json())
      .then(d => setStats(Array.isArray(d) ? d : []))
  }, [])

  if (!stats.length) return null

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Market Intelligence
          </p>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Avg Price by City
          </h2>
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>FOR_SALE · Zillow</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="city" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            />
            <Bar dataKey="avg_price" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.slice(0, 3).map(s => (
          <div key={s.city} className="rounded-xl border p-3 text-center" style={{ background: "var(--surface-container)" }}>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{s.city}</p>
            <p className="font-semibold text-sm mt-1" style={{ color: "var(--text-primary)" }}>
              {s.avg_price ? formatCurrency(s.avg_price) : "—"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.avg_days ?? "—"}d avg</p>
          </div>
        ))}
      </div>
    </div>
  )
}
