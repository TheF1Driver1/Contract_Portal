"use client"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { Search } from "lucide-react"
import type { MarketProperty } from "@/lib/types"
import { DataTable } from "@/components/app/DataTable"
import { EmptyState } from "@/components/app/EmptyState"
import { MotivationBadge } from "@/components/market/MotivationBadge"
import { motivationLevel } from "@/components/market/motivation"

export default function MarketListView({ properties }: { properties: MarketProperty[] }) {
  const t = useTranslations("market")
  const f = useFormatter()
  const router = useRouter()

  const money = (n: number | null) => (n ? f.number(n, "money") : "—")

  const columns: ColumnDef<MarketProperty, unknown>[] = [
    {
      id: "address",
      header: t("columns.address"),
      accessorFn: (p) => p.street ?? "",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.original.street ?? "—"}</p>
          {row.original.homeType && (
            <p className="text-xs text-muted-foreground">{row.original.homeType.replace(/_/g, " ").toLowerCase()}</p>
          )}
        </div>
      ),
    },
    {
      id: "city",
      header: t("columns.city"),
      accessorFn: (p) => p.city ?? "",
      filterFn: "equalsString",
    },
    {
      id: "price",
      header: t("columns.price"),
      accessorFn: (p) => p.price ?? 0,
      cell: ({ row }) => <span className="tabular font-medium">{money(row.original.price)}</span>,
    },
    {
      id: "bedsBaths",
      header: t("columns.bedsBaths"),
      accessorFn: (p) => p.beds ?? 0,
      cell: ({ row }) => (
        <span className="tabular">{t("bedsBaths", { beds: row.original.beds ?? "—", baths: row.original.baths ?? "—" })}</span>
      ),
    },
    {
      id: "days",
      header: t("columns.days"),
      accessorFn: (p) => p.daysOnZillow ?? -1,
      cell: ({ row }) => <span className="tabular">{row.original.daysOnZillow ?? "—"}</span>,
    },
    {
      id: "cuts",
      header: t("columns.cuts"),
      accessorFn: (p) => p.num_price_cuts ?? 0,
      cell: ({ row }) => {
        const p = row.original
        if (!p.num_price_cuts) return <span className="text-subtle-foreground">—</span>
        return (
          <span className="tabular">
            {t("cuts", { count: p.num_price_cuts })}
            {p.price_cut_pct != null && <span className="text-muted-foreground"> · ↓{p.price_cut_pct}%</span>}
          </span>
        )
      },
    },
    {
      id: "motivation",
      header: t("columns.motivation"),
      accessorFn: (p) => p.desperation_score ?? 0,
      // Sorts by score; the facet filters by level bucket.
      filterFn: (row, _id, value) => motivationLevel(row.original.desperation_score) === value,
      cell: ({ row }) => <MotivationBadge score={row.original.desperation_score} />,
    },
  ]

  const cities = useMemo(
    () => [...new Set(properties.map((p) => p.city).filter((c): c is string => !!c))].sort(),
    [properties]
  )

  return (
    <DataTable
      id="market"
      columns={columns}
      data={properties}
      searchPlaceholder={t("searchPlaceholder")}
      facets={[
        { columnId: "city", label: t("columns.city"), options: cities.map((c) => ({ value: c, label: c })) },
        {
          columnId: "motivation",
          label: t("columns.motivation"),
          options: (["high", "moderate", "mild", "none"] as const).map((l) => ({ value: l, label: t(`motivation.levels.${l}`) })),
        },
      ]}
      onRowClick={(p) => router.push(`/market/${p.id}`)}
      mobileRow={(p) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="tabular text-base font-semibold text-foreground">{money(p.price)}</p>
            <MotivationBadge score={p.desperation_score} />
          </div>
          <p className="truncate text-sm text-foreground">{[p.street, p.city].filter(Boolean).join(", ") || "—"}</p>
          <p className="tabular text-xs text-muted-foreground">
            {t("bedsBaths", { beds: p.beds ?? "—", baths: p.baths ?? "—" })}
            {p.daysOnZillow != null && <> · {t("daysListed", { count: p.daysOnZillow })}</>}
            {!!p.num_price_cuts && <> · {t("cuts", { count: p.num_price_cuts })}{p.price_cut_pct != null && ` ↓${p.price_cut_pct}%`}</>}
          </p>
        </div>
      )}
      csv={{
        filename: "mercado.csv",
        columns: [
          { header: t("columns.address"), value: (p) => p.street },
          { header: t("columns.city"), value: (p) => p.city },
          { header: t("columns.price"), value: (p) => p.price },
          { header: t("csv.beds"), value: (p) => p.beds },
          { header: t("csv.baths"), value: (p) => p.baths },
          { header: t("columns.days"), value: (p) => p.daysOnZillow },
          { header: t("columns.cuts"), value: (p) => p.num_price_cuts },
          { header: t("csv.cutPct"), value: (p) => p.price_cut_pct },
          { header: t("columns.motivation"), value: (p) => p.desperation_score },
          { header: t("csv.url"), value: (p) => p.detailUrl },
        ],
      }}
      empty={<EmptyState icon={Search} title={t("empty.title")} description={t("empty.description")} />}
    />
  )
}
