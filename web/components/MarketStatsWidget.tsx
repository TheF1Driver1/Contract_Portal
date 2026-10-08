"use client"
import { useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

export interface CityStat {
  city: string
  count?: number
  avg_price: number | null
  avg_days: number | null
  avg_motivation?: number | null
}

const AXIS_TICK = { fill: "var(--subtle-foreground)", fontSize: 12 }
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
}

/** Average listing price by city. Pass `stats` to skip the fetch. */
export default function MarketStatsWidget({ stats: provided }: { stats?: CityStat[] }) {
  const t = useTranslations("market.stats")
  const f = useFormatter()
  const [fetched, setFetched] = useState<CityStat[]>([])

  useEffect(() => {
    if (provided) return
    fetch("/api/market/stats")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setFetched(Array.isArray(d) ? d : Array.isArray(d?.stats) ? d.stats : []))
      .catch(() => setFetched([]))
  }, [provided])

  const stats = provided ?? fetched
  if (!stats.length) return null

  return (
    <section className="space-y-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="market-stats-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="market-stats-title" className="text-base font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ left: 4, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="city" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={v => f.number(Number(v), { style: "currency", currency: "USD", notation: "compact" })}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-hover)" }}
              formatter={(v) => [f.number(Number(v), "money"), t("avgPrice")]}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            />
            <Bar dataKey="avg_price" name={t("avgPrice")} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {stats.slice(0, 3).map(s => (
          <div key={s.city} className="rounded-lg bg-surface-muted p-3">
            <dt className="truncate text-xs text-muted-foreground">{s.city}</dt>
            <dd className="tabular mt-1 text-sm font-semibold text-foreground">
              {s.avg_price ? f.number(s.avg_price, "money") : "—"}
            </dd>
            <dd className="tabular text-xs text-muted-foreground">
              {s.avg_days != null ? t("avgDays", { count: s.avg_days }) : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
