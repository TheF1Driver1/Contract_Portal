"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RentRow = {
  id: string;
  tenant: string;
  property: string;
  rent: number;
  balance: number;
  overdue: number;
  nextDue: string | null;
  status: string;
};

export function RentOverview({ rows, kpis }: { rows: RentRow[]; kpis: { expected: number; collected: number; overdue: number; leases: number } }) {
  const t = useTranslations("rent.overview");
  const f = useFormatter();
  const router = useRouter();
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string | null) => (d ? f.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "medium" }) : "—");

  const columns: ColumnDef<RentRow, unknown>[] = [
    { id: "tenant", accessorFn: (r) => r.tenant, header: t("col.tenant"), cell: ({ row }) => <span className="font-medium">{row.original.tenant}</span> },
    { id: "property", accessorFn: (r) => r.property, header: t("col.property") },
    { id: "rent", accessorFn: (r) => r.rent, header: t("col.rent"), cell: ({ row }) => <span className="tabular">{money(row.original.rent)}</span> },
    { id: "balance", accessorFn: (r) => r.balance, header: t("col.balance"), cell: ({ row }) => <span className="tabular">{money(row.original.balance)}</span> },
    {
      id: "overdue",
      accessorFn: (r) => r.overdue,
      header: t("col.overdue"),
      cell: ({ row }) => <span className={cn("tabular", row.original.overdue > 0 && "font-medium text-danger")}>{row.original.overdue > 0 ? money(row.original.overdue) : "—"}</span>,
    },
    { id: "nextDue", accessorFn: (r) => r.nextDue ?? "", header: t("col.nextDue"), cell: ({ row }) => date(row.original.nextDue) },
  ];

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t("expected")} value={money(kpis.expected)} />
        <Kpi label={t("collected")} value={money(kpis.collected)} sub={kpis.expected > 0 ? f.number(Math.min(kpis.collected / kpis.expected, 9.99), { style: "percent" }) : undefined} />
        <Kpi label={t("overdue")} value={money(kpis.overdue)} danger={kpis.overdue > 0} />
        <Kpi label={t("leases")} value={String(kpis.leases)} />
      </dl>
      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/contracts?status=signed">{t("goContracts")}</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          id="rent"
          columns={columns}
          data={rows}
          onRowClick={(r) => router.push(`/contracts/${r.id}`)}
          initialSorting={[{ id: "overdue", desc: true }]}
          mobileRow={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.tenant}</p>
                <p className="truncate text-xs text-muted-foreground">{r.property} · {date(r.nextDue)}</p>
              </div>
              <span className={cn("tabular font-medium", r.overdue > 0 && "text-danger")}>{money(r.overdue > 0 ? r.overdue : r.balance)}</span>
            </div>
          )}
          csv={{
            filename: "cobros",
            columns: [
              { header: t("col.tenant"), value: (r) => r.tenant },
              { header: t("col.property"), value: (r) => r.property },
              { header: t("col.rent"), value: (r) => r.rent },
              { header: t("col.balance"), value: (r) => r.balance },
              { header: t("col.overdue"), value: (r) => r.overdue },
              { header: t("col.nextDue"), value: (r) => r.nextDue ?? "" },
            ],
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 text-xl font-semibold", danger && "text-danger")}>{value}</dd>
      {sub && <dd className="tabular text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}
