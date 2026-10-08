"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Landmark, List, Map as MapIcon, Pencil, FileUp, Plus, Users, X } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { CsvImportSheet } from "@/components/app/CsvImportSheet";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PropertyMap from "@/components/PropertyMap";
import AddPropertyModal from "@/app/(dashboard)/properties/AddPropertyModal";
import EditPropertyModal from "@/app/(dashboard)/properties/EditPropertyModal";
import CoOwnersModal from "@/app/(dashboard)/properties/CoOwnersModal";
import { CrimSheet, type CrimSheetData } from "@/components/tax/CrimSheet";
import type { Jurisdiction, Property } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PropertyRow = Property & {
  /** Signed contracts on this property. */
  activeLeases: number;
  /** Year-to-date expenses. */
  ytdExpenses: number;
  /** Signed monthly rent x 12. */
  annualIncome: number;
};

const JURISDICTIONS: Jurisdiction[] = ["pr", "us_mainland", "other"];

function matches(p: Property, q: string) {
  const needle = q.toLowerCase();
  return [p.name, p.address, p.city, p.zip].some((v) => v?.toLowerCase().includes(needle));
}

export function PropertiesView({
  rows,
  initialQuery,
  openNew,
  openImport,
  crim,
}: {
  rows: PropertyRow[];
  /** `?q=` deep link from the command palette. */
  initialQuery?: string;
  /** `?new=1` deep link from the command palette. */
  openNew?: boolean;
  /** `?import=1` deep link from the getting-started checklist. */
  openImport?: boolean;
  /** `?crim=<id>`: CRIM account, bills and estimate for one property (Plan 35). */
  crim?: CrimSheetData | null;
}) {
  const t = useTranslations("properties");
  const tc = useTranslations("common");
  const tTax = useTranslations("tax.crim");
  const f = useFormatter();
  const router = useRouter();
  const pathname = usePathname();

  const [createOpen, setCreateOpen] = useState(!!openNew);
  const [importOpen, setImportOpen] = useState(!!openImport);
  const tImport = useTranslations("common.csvImport");
  const [editing, setEditing] = useState<Property | null>(null);
  const [coOwnersOf, setCoOwnersOf] = useState<Property | null>(null);

  // Reopen when the command palette navigates here again with `?new=1`.
  const [lastOpenNew, setLastOpenNew] = useState(openNew);
  if (openNew !== lastOpenNew) {
    setLastOpenNew(openNew);
    if (openNew) setCreateOpen(true);
  }

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    // Drop `?new=1` so a refresh doesn't reopen the sheet.
    if (!open && openNew) {
      const qs = initialQuery ? `?q=${encodeURIComponent(initialQuery)}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    }
  }

  const query = initialQuery?.trim() ?? "";
  const visible = useMemo(() => (query ? rows.filter((r) => matches(r, query)) : rows), [rows, query]);
  const mapped = useMemo(
    () => rows.filter((p) => p.latitude && p.longitude) as (PropertyRow & { latitude: number; longitude: number })[],
    [rows]
  );

  const money = (n: number) => f.number(n, "money");
  const jurisdictionLabel = (j: Jurisdiction | null | undefined) => (j ? t(`jurisdiction.${j}`) : "—");

  const rowActions = (p: PropertyRow) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 md:size-8"
        aria-label={tTax("open", { name: p.name })}
        onClick={() => router.push(`${pathname}?crim=${p.id}`, { scroll: false })}
      >
        <Landmark />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 md:size-8"
        aria-label={t("actions.coOwners", { name: p.name })}
        onClick={() => setCoOwnersOf(p)}
      >
        <Users />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 md:size-8"
        aria-label={t("actions.edit", { name: p.name })}
        onClick={() => setEditing(p)}
      >
        <Pencil />
      </Button>
    </div>
  );

  const columns: ColumnDef<PropertyRow, unknown>[] = [
    {
      id: "name",
      accessorFn: (p) => p.name,
      header: t("col.name"),
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: "location",
      accessorFn: (p) => [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
      header: t("col.location"),
      cell: ({ row }) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-foreground">{row.original.address}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[row.original.city, row.original.state].filter(Boolean).join(", ")}
          </p>
        </div>
      ),
    },
    {
      id: "units",
      accessorFn: (p) => p.unit_count,
      header: t("col.units"),
      enableGlobalFilter: false,
      cell: ({ row }) => <span className="tabular">{row.original.unit_count}</span>,
    },
    {
      id: "jurisdiction",
      accessorFn: (p) => p.jurisdiction ?? "",
      header: t("col.jurisdiction"),
      filterFn: "equals",
      enableGlobalFilter: false,
      cell: ({ row }) => jurisdictionLabel(row.original.jurisdiction),
    },
    {
      id: "activeLeases",
      accessorFn: (p) => p.activeLeases,
      header: t("col.activeLeases"),
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="tabular">
          {t("leasesOf", { active: row.original.activeLeases, units: row.original.unit_count })}
        </span>
      ),
    },
    {
      id: "expenses",
      accessorFn: (p) => p.ytdExpenses,
      header: t("col.expenses"),
      enableGlobalFilter: false,
      cell: ({ row }) => <span className="tabular">{money(row.original.ytdExpenses)}</span>,
    },
    {
      id: "net",
      accessorFn: (p) => p.annualIncome - p.ytdExpenses,
      header: t("col.net"),
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const net = row.original.annualIncome - row.original.ytdExpenses;
        return (
          <span className={cn("tabular font-medium", net < 0 ? "text-danger" : "text-foreground")}>
            {net > 0 ? "+" : ""}
            {money(net)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{tc("actions")}</span>,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => rowActions(row.original),
    },
  ];

  const mobileRow = (p: PropertyRow) => {
    const net = p.annualIncome - p.ytdExpenses;
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[p.address, p.city].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("unitsCount", { count: p.unit_count })}
            {p.bathroom_count ? ` · ${t("bathsCount", { count: p.bathroom_count })}` : ""}
            {p.parking_available ? ` · ${t("parking")}` : ""}
            {" · "}
            {jurisdictionLabel(p.jurisdiction)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("col.activeLeases")}:{" "}
            <span className="tabular text-foreground">
              {t("leasesOf", { active: p.activeLeases, units: p.unit_count })}
            </span>
            {" · "}
            {t("col.net")}:{" "}
            <span className={cn("tabular", net < 0 ? "text-danger" : "text-foreground")}>
              {net > 0 ? "+" : ""}
              {money(net)}
            </span>
          </p>
        </div>
        {rowActions(p)}
      </div>
    );
  };

  const usedJurisdictions = JURISDICTIONS.filter((j) => rows.some((r) => r.jurisdiction === j));

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp />
              {tImport("button")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("add")}
            </Button>
          </>
        }
      />
      <CsvImportSheet
        kind="properties"
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o && openImport) router.replace(pathname, { scroll: false });
        }}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("addFirst")}
          description={t("emptyDescription")}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("add")}
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="list" className="gap-4">
          <TabsList>
            <TabsTrigger value="list" className="min-h-10 px-3 md:min-h-0">
              <List aria-hidden />
              {t("tabs.list")}
            </TabsTrigger>
            <TabsTrigger value="map" className="min-h-10 px-3 md:min-h-0">
              <MapIcon aria-hidden />
              {t("tabs.map")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {query && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                <span className="min-w-0 flex-1">{t("filteredBy", { query })}</span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={pathname}>
                    <X aria-hidden />
                    {t("clearFilter")}
                  </Link>
                </Button>
              </div>
            )}
            <DataTable
              id="properties"
              columns={columns}
              data={visible}
              searchPlaceholder={t("searchPlaceholder")}
              mobileRow={mobileRow}
              facets={
                usedJurisdictions.length > 1
                  ? [
                      {
                        columnId: "jurisdiction",
                        label: t("col.jurisdiction"),
                        options: usedJurisdictions.map((j) => ({ value: j, label: t(`jurisdiction.${j}`) })),
                      },
                    ]
                  : []
              }
              csv={{
                filename: "propiedades.csv",
                columns: [
                  { header: t("col.name"), value: (p) => p.name },
                  { header: t("form.street"), value: (p) => p.address },
                  { header: t("form.city"), value: (p) => p.city },
                  { header: t("form.state"), value: (p) => p.state },
                  { header: t("form.zip"), value: (p) => p.zip },
                  { header: t("col.units"), value: (p) => p.unit_count },
                  { header: t("col.jurisdiction"), value: (p) => jurisdictionLabel(p.jurisdiction) },
                  { header: t("col.activeLeases"), value: (p) => p.activeLeases },
                  { header: t("col.expenses"), value: (p) => p.ytdExpenses },
                  { header: t("col.net"), value: (p) => p.annualIncome - p.ytdExpenses },
                ],
              }}
            />
          </TabsContent>

          <TabsContent value="map" className="space-y-3">
            {mapped.length === 0 && (
              <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                {t("noMapped")}
              </p>
            )}
            <PropertyMap properties={mapped} allProperties={rows} label={t("map.label")} />
          </TabsContent>
        </Tabs>
      )}

      <AddPropertyModal open={createOpen} onOpenChange={handleCreateOpenChange} />
      {editing && (
        <EditPropertyModal
          key={editing.id}
          property={editing}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      {crim && (
        <CrimSheet
          key={crim.property.id}
          data={crim}
          open
          onOpenChange={(open) => !open && router.replace(pathname, { scroll: false })}
        />
      )}
      {coOwnersOf && (
        <CoOwnersModal
          key={coOwnersOf.id}
          property={coOwnersOf}
          open={!!coOwnersOf}
          onOpenChange={(open) => !open && setCoOwnersOf(null)}
        />
      )}
    </div>
  );
}
