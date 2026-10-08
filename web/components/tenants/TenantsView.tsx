"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, FileUp, Plus, Users, X } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { CsvImportSheet } from "@/components/app/CsvImportSheet";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AddTenantModal from "@/app/(dashboard)/tenants/AddTenantModal";
import EditTenantModal from "@/app/(dashboard)/tenants/EditTenantModal";
import type { Tenant } from "@/lib/types";

function matches(t: Tenant, q: string) {
  const needle = q.toLowerCase();
  return [t.full_name, t.email, t.phone].some((v) => v?.toLowerCase().includes(needle));
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function TenantsView({
  tenants,
  initialQuery,
  openNew,
  openImport,
}: {
  tenants: Tenant[];
  /** `?q=` deep link from the command palette. */
  initialQuery?: string;
  /** `?new=1` deep link from the command palette. */
  openNew?: boolean;
  /** `?import=1` deep link from the getting-started checklist. */
  openImport?: boolean;
}) {
  const t = useTranslations("tenants");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();

  const [createOpen, setCreateOpen] = useState(!!openNew);
  const [importOpen, setImportOpen] = useState(!!openImport);
  const tImport = useTranslations("common.csvImport");
  const [editing, setEditing] = useState<Tenant | null>(null);

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
  const visible = useMemo(() => (query ? tenants.filter((r) => matches(r, query)) : tenants), [tenants, query]);

  const editButton = (tenant: Tenant) => (
    <Button
      variant="ghost"
      size="icon"
      className="size-10 md:size-8"
      aria-label={t("actions.edit", { name: tenant.full_name })}
      onClick={() => setEditing(tenant)}
    >
      <Pencil />
    </Button>
  );

  const columns: ColumnDef<Tenant, unknown>[] = [
    {
      id: "name",
      accessorFn: (r) => r.full_name,
      header: t("col.name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
              {initial(row.original.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{row.original.full_name}</span>
        </div>
      ),
    },
    {
      id: "email",
      accessorFn: (r) => r.email ?? "",
      header: t("col.email"),
      cell: ({ row }) =>
        row.original.email ? (
          <a href={`mailto:${row.original.email}`} className="text-foreground hover:underline">
            {row.original.email}
          </a>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      id: "phone",
      accessorFn: (r) => r.phone ?? "",
      header: t("col.phone"),
      cell: ({ row }) =>
        row.original.phone ? (
          <a href={`tel:${row.original.phone}`} className="tabular text-foreground hover:underline">
            {row.original.phone}
          </a>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      id: "license",
      accessorFn: (r) => r.license_number ?? "",
      header: t("col.license"),
      cell: ({ row }) => row.original.license_number || <span className="text-subtle-foreground">—</span>,
    },
    {
      id: "address",
      accessorFn: (r) => r.current_address ?? "",
      header: t("col.address"),
      cell: ({ row }) =>
        row.original.current_address ? (
          <span className="block max-w-xs truncate text-muted-foreground">{row.original.current_address}</span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{tc("actions")}</span>,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => <div className="flex justify-end">{editButton(row.original)}</div>,
    },
  ];

  const mobileRow = (r: Tenant) => (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary-soft-foreground">
          {initial(r.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{r.full_name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[r.email, r.phone].filter(Boolean).join(" · ") || t("noContact")}
        </p>
        {r.current_address && <p className="truncate text-xs text-muted-foreground">{r.current_address}</p>}
      </div>
      {editButton(r)}
    </div>
  );

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
        kind="tenants"
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o && openImport) router.replace(pathname, { scroll: false });
        }}
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
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
        <div className="space-y-3">
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
            id="tenants"
            columns={columns}
            data={visible}
            searchPlaceholder={t("searchPlaceholder")}
            mobileRow={mobileRow}
            csv={{
              filename: "inquilinos.csv",
              columns: [
                { header: t("col.name"), value: (r) => r.full_name },
                { header: t("col.email"), value: (r) => r.email },
                { header: t("col.phone"), value: (r) => r.phone },
                { header: t("col.address"), value: (r) => r.current_address },
              ],
            }}
          />
        </div>
      )}

      <AddTenantModal open={createOpen} onOpenChange={handleCreateOpenChange} />
      {editing && (
        <EditTenantModal
          key={editing.id}
          tenant={editing}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  );
}
