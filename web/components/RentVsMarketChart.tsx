"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"

export default function RentVsMarketChart() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/market/compare")
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
  }, [])

  if (!data.length) return null

  return (
    <div className="surface-card p-6 space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Analysis
        </p>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Your Rent vs Market
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Monthly rent (signed contracts) vs avg Zillow listing price by city
        </p>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
            <Legend />
            <Bar dataKey="avg_rent" name="Your Avg Rent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="avg_market" name="Market Avg Price" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
