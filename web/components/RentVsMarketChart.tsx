"use client"
import { useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface Row { city: string; avg_rent: number; avg_market: number | null }

const AXIS_TICK = { fill: "var(--subtle-foreground)", fontSize: 12 }
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
}

/**
 * Your signed rent vs. average listing price per city. Monthly rent and sale
 * price live on very different scales, so the chart plots one measure — gross
 * yield (rent × 12 ÷ price) — and the raw values sit in the list below.
 */
export default function RentVsMarketChart() {
  const t = useTranslations("market.rentVsMarket")
  const f = useFormatter()
  const [data, setData] = useState<Row[]>([])

  useEffect(() => {
    fetch("/api/market/compare")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
  }, [])

  if (!data.length) return null

  const rows = data.map(d => ({
    ...d,
    yield_pct: d.avg_market ? Math.round(((d.avg_rent * 12) / d.avg_market) * 1000) / 10 : null,
  }))
  const charted = rows.filter(r => r.yield_pct != null)

  return (
    <section className="space-y-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="rent-vs-market-title">
      <div>
        <h2 id="rent-vs-market-title" className="text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {charted.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charted} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="city" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}%`} />
              <Tooltip
                cursor={{ fill: "var(--surface-hover)" }}
                formatter={(v) => [`${v}%`, t("yield")]}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              />
              <Bar dataKey="yield_pct" name={t("yield")} fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="pb-2 font-medium">{t("city")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("yourRent")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("marketPrice")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("yield")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.city} className="border-t">
              <th scope="row" className="py-2 text-left font-medium text-foreground">{r.city}</th>
              <td className="tabular py-2 text-right">{f.number(r.avg_rent, "money")}</td>
              <td className="tabular py-2 text-right">{r.avg_market ? f.number(r.avg_market, "money") : "—"}</td>
              <td className="tabular py-2 text-right">{r.yield_pct != null ? `${r.yield_pct}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
