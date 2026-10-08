import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { daysUntil } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import ContractsTable, { type ContractRow } from "@/components/contracts/ContractsTable";
import ExpiryReminderBar from "./ExpiryReminderBar";

export default async function ContractsPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations("contracts");
  const tStatus = await getTranslations("common.status");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("contracts")
    .select("*, property:properties(name, address), tenant:tenants(full_name, email, phone)")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  // `?status=` deep links (dashboard cards) still narrow the list server-side.
  if (searchParams.status) {
    query = query.eq("status", searchParams.status as Contract["status"]);
  }

  const { data: contracts } = await query;
  const all = (contracts ?? []) as unknown as Contract[]; // joined subset of Property/Tenant

  const q = searchParams.q?.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (c) =>
          c.tenant?.full_name?.toLowerCase().includes(q) ||
          c.property?.name?.toLowerCase().includes(q)
      )
    : all;

  const rows: ContractRow[] = filtered.map((c) => ({
    id: c.id,
    tenant: c.tenant?.full_name ?? "",
    property: c.property?.name ?? "",
    status: c.status,
    leaseStart: c.lease_start,
    leaseEnd: c.lease_end,
    rent: Number(c.rent_amount) || 0,
    daysLeft: daysUntil(c.lease_end),
  }));

  const hasUrlFilter = !!(searchParams.status || searchParams.q);
  const newButton = (
    <Button asChild>
      <Link href="/contracts/new">
        <Plus />
        {t("new")}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("list.description")} actions={newButton} />

      {hasUrlFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("list.filteredBy")}</span>
          {searchParams.status && (
            <span className="font-medium text-foreground">
              {t("list.filterStatus", {
                status: tStatus.has(searchParams.status as "draft")
                  ? tStatus(searchParams.status as "draft")
                  : searchParams.status,
              })}
            </span>
          )}
          {searchParams.q && (
            <span className="font-medium text-foreground">{t("list.filterQuery", { q: searchParams.q })}</span>
          )}
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/contracts">
              <X />
              {t("list.clearFilter")}
            </Link>
          </Button>
        </div>
      )}

      {all.length === 0 && !hasUrlFilter ? (
        <EmptyState
          icon={FileText}
          title={t("list.emptyTitle")}
          description={t("list.emptyDescription")}
          action={
            <Button asChild>
              <Link href="/contracts/new">
                <Plus />
                {t("list.emptyAction")}
              </Link>
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-surface p-6 text-center text-sm text-muted-foreground">
          {t("list.noUrlMatches")}
        </p>
      ) : (
        <ContractsTable rows={rows} />
      )}

      <ExpiryReminderBar />
    </div>
  );
}
