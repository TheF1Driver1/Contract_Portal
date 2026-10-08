"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Download, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FacetFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

type View = { name: string; query: string; filters: ColumnFiltersState; sorting: SortingState };

/** Quote a value for CSV (RFC 4180). */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Sortable, filterable list with saved views (per browser) and CSV export.
 * On phones each row renders through `mobileRow` as a stacked card.
 */
export function DataTable<T>({
  id,
  columns,
  data,
  facets = [],
  searchPlaceholder,
  mobileRow,
  onRowClick,
  csv,
  empty,
  toolbar,
  pageSize = 25,
  initialQuery,
  initialFilters,
  initialSorting,
}: {
  /** Key for saved views in localStorage. */
  id: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  facets?: FacetFilter[];
  searchPlaceholder?: string;
  mobileRow?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Header + value accessors for CSV export; omit to hide the button. */
  csv?: { filename: string; columns: { header: string; value: (row: T) => unknown }[] };
  empty?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  /** Starting state, e.g. from ?q= or ?status= in the URL. */
  initialQuery?: string;
  initialFilters?: ColumnFiltersState;
  initialSorting?: SortingState;
}) {
  const t = useTranslations("common");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [filters, setFilters] = useState<ColumnFiltersState>(initialFilters ?? []);
  const [views, setViews] = useState<View[]>([]);
  const storageKey = `datatable:${id}:views`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setViews(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  function persist(next: View[]) {
    setViews(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: query, sorting, columnFilters: filters },
    onGlobalFilterChange: setQuery,
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const filteredRows = table.getFilteredRowModel().rows;
  const pageCount = table.getPageCount();

  const facetValue = (columnId: string) =>
    (filters.find((f) => f.id === columnId)?.value as string | undefined) ?? "";

  function setFacet(columnId: string, value: string) {
    setFilters((prev) => [...prev.filter((f) => f.id !== columnId), ...(value ? [{ id: columnId, value }] : [])]);
  }

  const exportCsv = useMemo(
    () =>
      csv
        ? () => {
            const lines = [
              csv.columns.map((c) => csvCell(c.header)).join(","),
              ...filteredRows.map((r) => csv.columns.map((c) => csvCell(c.value(r.original))).join(",")),
            ];
            const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = csv.filename;
            a.click();
            URL.revokeObjectURL(url);
          }
        : null,
    [csv, filteredRows]
  );

  if (data.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? t("search")}
            className="pl-8"
            aria-label={searchPlaceholder ?? t("search")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {facets.map((f) => (
            <select
              key={f.columnId}
              aria-label={f.label}
              value={facetValue(f.columnId)}
              onChange={(e) => setFacet(f.columnId, e.target.value)}
              className="h-9 rounded-md border border-input bg-surface px-2 text-sm"
            >
              <option value="">
                {f.label}: {t("all")}
              </option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bookmark />
                {t("savedViews")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t("savedViews")}</DropdownMenuLabel>
              {views.map((v) => (
                <DropdownMenuItem
                  key={v.name}
                  onSelect={() => {
                    setQuery(v.query);
                    setFilters(v.filters);
                    setSorting(v.sorting);
                  }}
                >
                  <span className="flex-1 truncate">{v.name}</span>
                  <button
                    type="button"
                    aria-label={`${t("deleteView")}: ${v.name}`}
                    className="text-subtle-foreground hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      persist(views.filter((x) => x.name !== v.name));
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
              {views.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={() => {
                  const name = window.prompt(t("viewName"))?.trim();
                  if (name) persist([...views.filter((v) => v.name !== name), { name, query, filters, sorting }]);
                }}
              >
                {t("saveView")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {exportCsv && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download />
              {t("exportCsv")}
            </Button>
          )}
          {toolbar}
        </div>
      </div>

      {/* Phones: stacked cards */}
      {mobileRow && (
        <ul className="space-y-2 md:hidden">
          {rows.map((r) => (
            <li key={r.id}>
              {onRowClick ? (
                <button
                  type="button"
                  className="w-full rounded-lg border bg-surface p-3 text-left hover:bg-surface-hover"
                  onClick={() => onRowClick(r.original)}
                >
                  {mobileRow(r.original)}
                </button>
              ) : (
                <div className="rounded-lg border bg-surface p-3">{mobileRow(r.original)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={cn("overflow-x-auto rounded-lg border bg-surface", mobileRow && "hidden md:block")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <TableHead key={h.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3.5" /> : sorted === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(r.original) : undefined}
                >
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t("noMatches")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("rowsCount", { count: filteredRows.length })}</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              {t("previous")}
            </Button>
            <span className="tabular">{t("page", { page: table.getState().pagination.pageIndex + 1, pages: pageCount })}</span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              {t("next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
