"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Building2, Landmark } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";

export type CrimRow = {
  id: string;
  name: string;
  municipality: string | null;
  assessed: number | null;
  estimate: number | null;
  billed: number;
  paid: number;
  nextDue: string | null;
  overdue: boolean;
};

export function CrimOverview({ rows, fiscalYear }: { rows: CrimRow[]; fiscalYear: string }) {
  const t = useTranslations("tax.crimPage");
  const f = useFormatter();
  const router = useRouter();
  const money = (n: number | null) => (n == null ? "—" : f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }));
  const date = (d: string | null) => (d ? f.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "medium" }) : "—");
  const open = (r: CrimRow) => router.push(`/properties?crim=${r.id}`);

  const due = (r: CrimRow) =>
    r.overdue ? (
      <span className="inline-flex items-center gap-1 font-medium text-danger">
        <AlertTriangle className="size-3.5" aria-hidden />
        {t("overdue")}
      </span>
    ) : (
      date(r.nextDue)
    );

  const columns: ColumnDef<CrimRow, unknown>[] = [
    { id: "name", accessorFn: (r) => r.name, header: t("col.property"), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: "municipality", accessorFn: (r) => r.municipality ?? "", header: t("col.municipality"), cell: ({ row }) => row.original.municipality ?? "—" },
    { id: "assessed", accessorFn: (r) => r.assessed ?? -1, header: t("col.assessed"), cell: ({ row }) => <span className="tabular">{money(row.original.assessed)}</span> },
    { id: "estimate", accessorFn: (r) => r.estimate ?? -1, header: t("col.estimate"), cell: ({ row }) => <span className="tabular">{money(row.original.estimate)}</span> },
    { id: "billed", accessorFn: (r) => r.billed, header: t("col.billed"), cell: ({ row }) => <span className="tabular">{money(row.original.billed)}</span> },
    { id: "paid", accessorFn: (r) => r.paid, header: t("col.paid"), cell: ({ row }) => <span className="tabular">{money(row.original.paid)}</span> },
    { id: "nextDue", accessorFn: (r) => r.nextDue ?? "", header: t("col.nextDue"), cell: ({ row }) => due(row.original) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description", { fy: fiscalYear })} />
      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/properties">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          id="crim"
          columns={columns}
          data={rows}
          onRowClick={open}
          searchPlaceholder={t("search")}
          mobileRow={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.municipality ?? "—"} · {t("col.estimate")}: <span className="tabular">{money(r.estimate)}</span>
                </p>
              </div>
              <span className="shrink-0 text-sm">{due(r)}</span>
            </div>
          )}
        />
      )}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("note")}
      </p>
    </div>
  );
}
