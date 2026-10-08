"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";

export type ContractRow = {
  id: string;
  tenant: string;
  property: string;
  status: string;
  leaseStart: string;
  leaseEnd: string;
  rent: number;
  daysLeft: number;
};

const STATUSES = ["draft", "sent", "signed", "expired", "cancelled"] as const;

/** Date-only strings (YYYY-MM-DD) parsed at noon so they never shift a day. */
export function dateOnly(d: string) {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d);
}

export default function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const t = useTranslations("contracts");
  const tStatus = useTranslations("common.status");
  const tc = useTranslations("common");
  const f = useFormatter();
  const router = useRouter();

  const fmtDate = (d: string) => (d ? f.dateTime(dateOnly(d), { dateStyle: "medium" }) : "—");
  const daysLabel = (n: number) => (n < 0 ? t("list.endedAgo", { count: -n }) : t("list.daysLeft", { count: n }));

  const columns = useMemo<ColumnDef<ContractRow, unknown>[]>(
    () => [
      {
        accessorKey: "tenant",
        header: t("list.colTenant"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.tenant || t("list.unknownTenant")}</span>
        ),
      },
      {
        accessorKey: "property",
        header: t("list.colProperty"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.property || "—"}</span>,
      },
      {
        accessorKey: "status",
        header: t("list.colStatus"),
        filterFn: "equalsString",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "lease",
        accessorFn: (r) => r.leaseStart,
        header: t("list.colLease"),
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {fmtDate(row.original.leaseStart)} – {fmtDate(row.original.leaseEnd)}
          </span>
        ),
      },
      {
        accessorKey: "rent",
        header: t("list.colRent"),
        enableGlobalFilter: false,
        cell: ({ row }) => <span className="tabular font-medium">{f.number(row.original.rent, "money")}</span>,
      },
      {
        accessorKey: "daysLeft",
        header: t("list.colDaysLeft"),
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const n = row.original.daysLeft;
          const active = row.original.status === "signed" || row.original.status === "sent";
          return (
            <span
              className={cn(
                "tabular whitespace-nowrap",
                n < 0 ? "text-subtle-foreground" : active && n <= 30 ? "font-medium text-warning" : "text-muted-foreground"
              )}
            >
              {daysLabel(n)}
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels/formatters are stable per locale
    [t, f]
  );

  const csv = useMemo(
    () => ({
      filename: "contratos.csv",
      columns: [
        { header: t("list.colTenant"), value: (r: ContractRow) => r.tenant },
        { header: t("list.colProperty"), value: (r: ContractRow) => r.property },
        { header: t("list.colStatus"), value: (r: ContractRow) => (tStatus.has(r.status as "draft") ? tStatus(r.status as "draft") : r.status) },
        { header: t("list.csvStart"), value: (r: ContractRow) => r.leaseStart },
        { header: t("list.csvEnd"), value: (r: ContractRow) => r.leaseEnd },
        { header: t("list.colRent"), value: (r: ContractRow) => r.rent },
        { header: t("list.colDaysLeft"), value: (r: ContractRow) => r.daysLeft },
      ],
    }),
    [t, tStatus]
  );

  return (
    <DataTable
      id="contracts"
      columns={columns}
      data={rows}
      searchPlaceholder={t("list.searchPlaceholder")}
      facets={[
        {
          columnId: "status",
          label: t("list.colStatus"),
          options: STATUSES.map((s) => ({ value: s, label: tStatus(s) })),
        },
      ]}
      csv={csv}
      onRowClick={(r) => router.push(`/contracts/${r.id}`)}
      mobileRow={(r) => (
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{r.tenant || t("list.unknownTenant")}</p>
            <StatusBadge status={r.status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {r.property || "—"} · <span className="tabular">{f.number(r.rent, "money")}</span>
            {tc("perMonth")}
          </p>
          <p className="text-xs text-muted-foreground">
            {fmtDate(r.leaseStart)} – {fmtDate(r.leaseEnd)} · {daysLabel(r.daysLeft)}
          </p>
        </div>
      )}
    />
  );
}
