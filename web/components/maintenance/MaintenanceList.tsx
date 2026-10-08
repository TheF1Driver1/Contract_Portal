"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { MaintenanceStatusBadge, UrgencyBadge } from "@/components/maintenance/Badges";
import { RequestForm } from "@/components/maintenance/RequestForm";
import { STATUSES, URGENCIES } from "@/lib/maintenance/logic";
import type { MaintenanceCategory, MaintenanceStatus, MaintenanceUrgency } from "@/lib/db";
import { cn } from "@/lib/utils";

export type MaintenanceRow = {
  id: string;
  title: string;
  property: string;
  tenant: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  createdAt: string;
  scheduledFor: string | null;
  cost: number | null;
  fromTenant: boolean;
};

export function MaintenanceList({
  rows,
  leases,
  kpis,
}: {
  rows: MaintenanceRow[];
  leases: { id: string; label: string }[];
  kpis: { open: number; urgent: number; scheduled: number; costYear: number };
}) {
  const t = useTranslations("maintenance");
  const f = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string | null) => (d ? f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" }) : "—");

  const columns: ColumnDef<MaintenanceRow, unknown>[] = [
    {
      id: "title",
      accessorFn: (r) => `${r.title} ${t(`category.${r.category}`)}`,
      header: t("col.title"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t(`category.${row.original.category}`)} · {row.original.fromTenant ? t("fromTenant") : t("fromLandlord")}
          </p>
        </div>
      ),
    },
    { id: "property", accessorFn: (r) => `${r.property} ${r.tenant}`, header: t("col.property"), cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate">{row.original.property}</p>
        {row.original.tenant && <p className="truncate text-xs text-muted-foreground">{row.original.tenant}</p>}
      </div>
    ) },
    { id: "urgency", accessorFn: (r) => r.urgency, header: t("col.urgency"), filterFn: "equals", enableGlobalFilter: false, cell: ({ row }) => <UrgencyBadge urgency={row.original.urgency} /> },
    { id: "status", accessorFn: (r) => r.status, header: t("col.status"), filterFn: "equals", enableGlobalFilter: false, cell: ({ row }) => <MaintenanceStatusBadge status={row.original.status} /> },
    { id: "createdAt", accessorFn: (r) => r.createdAt, header: t("col.created"), enableGlobalFilter: false, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{date(row.original.createdAt)}</span> },
    { id: "scheduledFor", accessorFn: (r) => r.scheduledFor ?? "", header: t("col.scheduled"), enableGlobalFilter: false, cell: ({ row }) => <span className="whitespace-nowrap">{date(row.original.scheduledFor)}</span> },
    { id: "cost", accessorFn: (r) => r.cost ?? 0, header: t("col.cost"), enableGlobalFilter: false, cell: ({ row }) => <span className="tabular">{row.original.cost != null ? money(row.original.cost) : "—"}</span> },
  ];

  const newButton = (
    <Button onClick={() => setOpen(true)}>
      <Plus aria-hidden />
      {t("new")}
    </Button>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} actions={rows.length > 0 ? newButton : undefined} />
      {rows.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label={t("kpi.open")} value={String(kpis.open)} />
          <Kpi label={t("kpi.urgent")} value={String(kpis.urgent)} danger={kpis.urgent > 0} />
          <Kpi label={t("kpi.scheduled")} value={String(kpis.scheduled)} />
          <Kpi label={t("kpi.costYear")} value={money(kpis.costYear)} />
        </dl>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Wrench} title={t("empty.title")} description={t("empty.body")} action={newButton} />
      ) : (
        <DataTable
          id="maintenance"
          columns={columns}
          data={rows}
          searchPlaceholder={t("search")}
          facets={[
            { columnId: "status", label: t("col.status"), options: STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })) },
            { columnId: "urgency", label: t("col.urgency"), options: URGENCIES.map((u) => ({ value: u, label: t(`urgency.${u}`) })) },
          ]}
          onRowClick={(r) => router.push(`/maintenance/${r.id}`)}
          mobileRow={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">{r.title}</p>
                <MaintenanceStatusBadge status={r.status} />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {r.property}
                {r.tenant ? ` · ${r.tenant}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <UrgencyBadge urgency={r.urgency} />
                <span>{t(`category.${r.category}`)}</span>
                <span>· {date(r.scheduledFor ?? r.createdAt)}</span>
              </div>
            </div>
          )}
          csv={{
            filename: "mantenimiento.csv",
            columns: [
              { header: t("col.title"), value: (r) => r.title },
              { header: t("col.category"), value: (r) => t(`category.${r.category}`) },
              { header: t("col.property"), value: (r) => r.property },
              { header: t("col.tenant"), value: (r) => r.tenant },
              { header: t("col.urgency"), value: (r) => t(`urgency.${r.urgency}`) },
              { header: t("col.status"), value: (r) => t(`status.${r.status}`) },
              { header: t("col.created"), value: (r) => r.createdAt.slice(0, 10) },
              { header: t("col.scheduled"), value: (r) => r.scheduledFor ?? "" },
              { header: t("col.cost"), value: (r) => r.cost ?? "" },
            ],
          }}
        />
      )}
      <RequestForm open={open} onOpenChange={setOpen} mode="landlord" leases={leases} />
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 text-xl font-semibold", danger && "text-danger")}>{value}</dd>
    </div>
  );
}
