"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, CircleCheck, CircleMinus, ExternalLink, Loader2, Lock, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import type { Property, PropertyExpense } from "@/lib/types";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, ExpenseFormSheet, type EditableExpense } from "./ExpenseFormSheet";

export type ExpenseRow = PropertyExpense & { property: { id: string; name: string } | null };

const MONEY = { style: "currency", currency: "USD" } as const;

function isHttpUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export default function ExpensesClient({
  expenses,
  properties,
  year,
  years,
  canExport,
  openNew,
  aiScan = false,
}: {
  expenses: ExpenseRow[];
  properties: Pick<Property, "id" | "name">[];
  year: number;
  years: number[];
  canExport: boolean;
  openNew: boolean;
  aiScan?: boolean;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const f = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [sheetOpen, setSheetOpen] = useState(openNew);
  const [editing, setEditing] = useState<EditableExpense | null>(null);
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // `?new=1` (e.g. from the command menu) opens the add sheet once; drop it from the URL.
  useEffect(() => {
    if (openNew) router.replace(`/expenses?year=${year}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = (n: number) => f.number(n, MONEY);
  const date = (d: string) => f.dateTime(new Date(d.slice(0, 10) + "T12:00:00"), { dateStyle: "medium" });
  const catLabel = (c: string) => (t.has(`categories.${c}`) ? t(`categories.${c}`) : c);

  function openAdd() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(e: ExpenseRow) {
    setEditing(e);
    setSheetOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : undefined);
      }
      toast.success(t("delete.done"));
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(t("delete.failed"), { description: err instanceof Error && err.message ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const deductible = expenses.filter((e) => e.is_tax_deductible).reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a);

  // ── Table ─────────────────────────────────────────────────────────────────
  const columns: ColumnDef<ExpenseRow, unknown>[] = [
    {
      id: "date",
      accessorKey: "expense_date",
      header: t("columns.date"),
      cell: ({ row }) => <span className="tabular whitespace-nowrap">{date(row.original.expense_date)}</span>,
    },
    {
      id: "property",
      accessorFn: (r) => r.property?.name ?? "",
      header: t("columns.property"),
      filterFn: "equalsString",
      cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue() as string}</span>,
    },
    {
      id: "category",
      accessorFn: (r) => catLabel(r.category),
      header: t("columns.category"),
      filterFn: "equalsString",
      enableSorting: false,
    },
    {
      id: "vendor",
      accessorFn: (r) => r.vendor ?? "",
      header: t("columns.vendor"),
      enableSorting: false,
      cell: ({ getValue }) => (getValue() as string) || <span className="text-subtle-foreground">—</span>,
    },
    {
      id: "description",
      accessorFn: (r) => r.description ?? "",
      header: t("columns.description"),
      enableSorting: false,
      cell: ({ getValue }) =>
        (getValue() as string) ? (
          <span className="block max-w-56 truncate" title={getValue() as string}>
            {getValue() as string}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      id: "amount",
      accessorFn: (r) => Number(r.amount),
      header: () => <span className="block text-right">{t("columns.amount")}</span>,
      cell: ({ row }) => (
        <span className="tabular block text-right font-medium text-foreground">{money(Number(row.original.amount))}</span>
      ),
    },
    {
      id: "deductible",
      accessorKey: "is_tax_deductible",
      header: t("columns.deductible"),
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => deductibleBadge(row.original.is_tax_deductible),
    },
    {
      id: "receipt",
      header: t("columns.receipt"),
      enableSorting: false,
      cell: ({ row }) => receiptLink(row.original.receipt_url),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("columns.actions")}</span>,
      enableSorting: false,
      cell: ({ row }) => rowActions(row.original),
    },
  ];

  function deductibleBadge(yes: boolean) {
    return yes ? (
      <Badge variant="outline" className="border-transparent bg-success-soft text-success">
        <CircleCheck aria-hidden />
        {t("deductibleYes")}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        <CircleMinus aria-hidden />
        {t("deductibleNo")}
      </Badge>
    );
  }

  function receiptLink(url: string | null) {
    if (!isHttpUrl(url)) return <span className="text-subtle-foreground">—</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline md:min-h-0"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t("viewReceipt")}
      </a>
    );
  }

  function rowActions(row: ExpenseRow) {
    const name = `${catLabel(row.category)} ${money(Number(row.amount))}`;
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 md:size-8"
          aria-label={t("editLabel", { name })}
          onClick={() => openEdit(row)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-danger hover:text-danger md:size-8"
          aria-label={t("deleteLabel", { name })}
          onClick={() => setToDelete(row)}
        >
          <Trash2 />
        </Button>
      </div>
    );
  }

  const propertyNames = [...new Set(expenses.map((e) => e.property?.name).filter((n): n is string => !!n))].sort();
  const categoriesPresent = EXPENSE_CATEGORIES.filter((c) => expenses.some((e) => e.category === c));

  const csv = canExport
    ? {
        filename: t("csv.filename", { year }),
        columns: [
          { header: t("columns.date"), value: (r: ExpenseRow) => r.expense_date.slice(0, 10) },
          { header: t("columns.property"), value: (r: ExpenseRow) => r.property?.name ?? "" },
          { header: t("columns.category"), value: (r: ExpenseRow) => catLabel(r.category) },
          { header: t("columns.vendor"), value: (r: ExpenseRow) => r.vendor ?? "" },
          { header: t("columns.description"), value: (r: ExpenseRow) => r.description ?? "" },
          { header: t("columns.amount"), value: (r: ExpenseRow) => Number(r.amount).toFixed(2) },
          {
            header: t("columns.deductible"),
            value: (r: ExpenseRow) => (r.is_tax_deductible ? tc("yes") : tc("no")),
          },
          { header: t("columns.receipt"), value: (r: ExpenseRow) => r.receipt_url ?? "" },
        ],
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor="expenses-year" className="sr-only">
                {t("year")}
              </Label>
              <Select
                value={String(year)}
                onValueChange={(v) => startTransition(() => router.push(`/expenses?year=${v}`))}
              >
                <SelectTrigger id="expenses-year" className="h-10 w-28 tabular md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)} className="tabular">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild variant="outline" className="h-10 md:h-9">
              <Link href="/reports/schedule-e">
                <BarChart3 />
                {t("scheduleE")}
              </Link>
            </Button>
            <Button className="h-10 md:h-9" onClick={openAdd}>
              <Plus />
              {t("new")}
            </Button>
          </>
        }
      />

      <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {expenses.length > 0 && (
          <section aria-label={t("summary.label", { year })} className="rounded-xl border bg-surface p-4 md:p-5">
            <dl className="flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("summary.total")} · {t("summary.count", { count: expenses.length })}
                </dt>
                <dd className="tabular text-base font-semibold text-foreground">{money(total)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("summary.deductible")}</dt>
                <dd className="tabular text-base font-semibold text-foreground">{money(deductible)}</dd>
              </div>
              <div className="hidden w-px self-stretch bg-border sm:block" aria-hidden />
              {byCategory.map(([cat, amount]) => (
                <div key={cat}>
                  <dt className="text-xs text-muted-foreground">{catLabel(cat)}</dt>
                  <dd className="tabular text-sm font-medium text-foreground">{money(amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <DataTable<ExpenseRow>
          id="expenses"
          columns={columns}
          data={expenses}
          searchPlaceholder={t("searchPlaceholder")}
          facets={[
            ...(propertyNames.length > 1
              ? [
                  {
                    columnId: "property",
                    label: t("columns.property"),
                    options: propertyNames.map((n) => ({ value: n, label: n })),
                  },
                ]
              : []),
            {
              columnId: "category",
              label: t("columns.category"),
              options: categoriesPresent.map((c) => ({ value: catLabel(c), label: catLabel(c) })),
            },
          ]}
          csv={csv}
          toolbar={
            !canExport ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/billing">
                  <Lock />
                  {t("exportLocked")}
                </Link>
              </Button>
            ) : undefined
          }
          mobileRow={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{catLabel(r.category)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.property?.name}
                    {r.vendor ? ` · ${r.vendor}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-foreground">{money(Number(r.amount))}</p>
                  <p className="tabular text-xs text-muted-foreground">{date(r.expense_date)}</p>
                </div>
              </div>
              {r.description && <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {deductibleBadge(r.is_tax_deductible)}
                  {isHttpUrl(r.receipt_url) && receiptLink(r.receipt_url)}
                </div>
                {rowActions(r)}
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={Receipt}
              title={t("empty.title", { year })}
              description={t("empty.description")}
              action={
                <Button onClick={openAdd}>
                  <Plus />
                  {t("new")}
                </Button>
              }
            />
          }
        />
      </div>

      <ExpenseFormSheet open={sheetOpen} onOpenChange={setSheetOpen} properties={properties} expense={editing} aiScan={aiScan} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>
              {toDelete &&
                t("delete.description", {
                  category: catLabel(toDelete.category),
                  amount: money(Number(toDelete.amount)),
                  date: date(toDelete.expense_date),
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              {deleting ? t("delete.deleting") : t("delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
