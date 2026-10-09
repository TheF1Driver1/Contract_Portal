export const dynamic = 'force-dynamic';

import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download, Eye, FileSignature, FileText, MapPin, PenLine, Receipt } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import type { Payment, RentCharge } from "@/lib/db";
import { summarize, type LedgerSummary } from "@/lib/rent/schedule";
import { todayPR } from "@/lib/rent/service";
import { receiptNumber } from "@/lib/rent/receipt";
import type { Inspection, MaintenanceRequest, MaintenanceUpdate } from "@/lib/db";
import { PortalLeaseExtras, type PortalInspection, type PortalRequest } from "@/components/maintenance/PortalMaintenance";
import { AthPay } from "@/components/portal/AthPay";
import { ATH_TIMEOUT_SECONDS, normalizeAthPhone } from "@/lib/athmovil/client";
import { athPendingSince, syncAthPayment } from "@/lib/athmovil/service";

interface PortalContract {
  id: string;
  owner_id: string;
  status: string;
  lease_start: string | null;
  lease_end: string | null;
  rent_amount: number | null;
  unit_number: string | null;
  pdf_url: string | null;
  property: { name: string | null; address: string | null; city: string | null } | null;
  tenant: { phone: string | null } | null;
}

type AthOffer = { business: string; phone: string; pending: { id: string; amount: number; expiresAt: string } | null };

/** Statuses where the tenant still has to sign. */
const CLOSED = new Set(["signed", "expired", "cancelled"]);

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("portal");
  const f = await getFormatter();
  const admin = createAdminClient();

  const { data: invites } = await admin
    .from("tenant_invites")
    .select("contract_id")
    .eq("used_by", user.id)
    .eq("used", true)
    .order("used_at", { ascending: false });

  const ids = [...new Set((invites ?? []).map((i) => i.contract_id as string).filter(Boolean))];

  let contracts: PortalContract[] = [];
  if (ids.length > 0) {
    const { data } = await admin
      .from("contracts")
      .select("id, owner_id, status, lease_start, lease_end, rent_amount, unit_number, pdf_url, property:properties(name, address, city), tenant:tenants(phone)")
      .in("id", ids);
    const byId = new Map(((data ?? []) as unknown as PortalContract[]).map((c) => [c.id, c]));
    // Keep invite order (most recently redeemed first), pending signatures on top.
    contracts = ids
      .map((id) => byId.get(id))
      .filter((c): c is PortalContract => Boolean(c))
      .sort((a, b) => Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)));
  }

  // Rent ledgers the landlord keeps for these leases (read with the service
  // role, scoped to the contracts this tenant redeemed an invite for).
  const ledgers = new Map<string, { summary: LedgerSummary; payments: Payment[] }>();
  if (ids.length > 0) {
    const today = todayPR();
    const [{ data: ls }, { data: charges }, { data: payments }] = await Promise.all([
      admin.from("rent_ledgers").select("contract_id").in("contract_id", ids),
      admin.from("rent_charges").select("*").in("contract_id", ids),
      admin.from("payments").select("*").in("contract_id", ids).is("voided_at", null).order("received_on", { ascending: false }),
    ]);
    for (const l of ls ?? []) {
      const ch = ((charges ?? []) as RentCharge[]).filter((c) => c.contract_id === l.contract_id);
      const pay = ((payments ?? []) as Payment[]).filter((p) => p.contract_id === l.contract_id);
      ledgers.set(l.contract_id, {
        summary: summarize(
          ch.map((c) => ({ kind: c.kind, period: c.period, due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at })),
          pay.map((p) => ({ amount: Number(p.amount), received_on: p.received_on })),
          today
        ),
        payments: pay.slice(0, 5),
      });
    }
  }
  // ATH Móvil (Plan 33): offered when the landlord connected ATH Business and
  // the lease has a balance. Only the business name leaves the accounts table.
  const athByLease = new Map<string, AthOffer>();
  const owners = [...new Set(contracts.filter((c) => c.status === "signed" && ledgers.has(c.id)).map((c) => c.owner_id))];
  if (owners.length > 0) {
    const since = athPendingSince();
    // A payment confirmed in the ATH app after the tab was closed is authorized
    // and posted now, instead of waiting for the daily cron (ATH may expire it).
    const { data: mine } = await admin
      .from("ath_movil_payments")
      .select("id")
      .eq("payer_user_id", user.id)
      .in("status", ["open", "confirm"])
      .gte("created_at", since)
      .limit(3);
    await Promise.allSettled((mine ?? []).map((p) => syncAthPayment(admin, p.id)));
    const [{ data: accounts }, { data: landlords }, { data: inflight }] = await Promise.all([
      admin.from("ath_movil_accounts").select("owner_id, business_name").in("owner_id", owners),
      admin.from("profiles").select("id, full_name, company_name").in("id", owners),
      admin
        .from("ath_movil_payments")
        .select("id, contract_id, amount, created_at")
        .eq("payer_user_id", user.id)
        .in("status", ["open", "confirm"])
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);
    for (const c of contracts) {
      const acct = (accounts ?? []).find((a) => a.owner_id === c.owner_id);
      if (!acct || c.status !== "signed" || !ledgers.has(c.id)) continue;
      const owner = (landlords ?? []).find((o) => o.id === c.owner_id);
      const p = (inflight ?? []).find((x) => x.contract_id === c.id);
      athByLease.set(c.id, {
        business: acct.business_name || owner?.company_name || owner?.full_name || t("ath.landlordFallback"),
        phone: normalizeAthPhone(c.tenant?.phone) ?? "",
        pending: p ? { id: p.id, amount: Number(p.amount), expiresAt: new Date(new Date(p.created_at).getTime() + ATH_TIMEOUT_SECONDS * 1000).toISOString() } : null,
      });
    }
  }

  // Repair requests and completed inspections for these leases (Plan 36).
  const requestsByLease = new Map<string, PortalRequest[]>();
  const inspectionsByLease = new Map<string, PortalInspection[]>();
  if (ids.length > 0) {
    const [{ data: reqs }, { data: insps }] = await Promise.all([
      admin.from("maintenance_requests").select("id, contract_id, title, status, category, scheduled_for, created_at").in("contract_id", ids).order("created_at", { ascending: false }),
      admin.from("inspections").select("id, contract_id, kind, inspected_on, tenant_acknowledged_at").in("contract_id", ids).eq("status", "completed").order("inspected_on"),
    ]);
    const reqIds = (reqs ?? []).map((r) => r.id);
    const { data: updates } = reqIds.length
      ? await admin.from("maintenance_updates").select("id, request_id, author_kind, note, status_change, created_at").in("request_id", reqIds).order("created_at")
      : { data: [] };
    for (const r of (reqs ?? []) as (MaintenanceRequest & { contract_id: string })[]) {
      const list = requestsByLease.get(r.contract_id) ?? [];
      list.push({ ...r, updates: ((updates ?? []) as MaintenanceUpdate[]).filter((u) => u.request_id === r.id) });
      requestsByLease.set(r.contract_id, list);
    }
    for (const i of (insps ?? []) as Inspection[]) {
      const list = inspectionsByLease.get(i.contract_id) ?? [];
      list.push({ id: i.id, kind: i.kind, inspected_on: i.inspected_on, acknowledged: !!i.tenant_acknowledged_at });
      inspectionsByLease.set(i.contract_id, list);
    }
  }

  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });

  const day = (d: string | null) => (d ? f.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "medium" }) : "—");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {contracts.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <section aria-labelledby="contracts-heading" className="space-y-3">
          <h2 id="contracts-heading" className="sr-only">
            {t("count", { count: contracts.length })}
          </h2>
          <ul className="space-y-3">
            {contracts.map((c) => {
              const pending = !CLOSED.has(c.status);
              const badgeStatus = pending ? "pending" : c.status;
              const address = [c.property?.address, c.property?.city].filter(Boolean).join(", ");
              return (
                <li key={c.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {c.property?.name || t("propertyFallback")}
                        {c.unit_number ? (
                          <span className="font-normal text-muted-foreground"> · {t("unit", { unit: c.unit_number })}</span>
                        ) : null}
                      </h3>
                      {address && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{address}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={badgeStatus} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("rent")}</dt>
                      <dd className="tabular font-medium text-foreground">
                        {c.rent_amount != null ? f.number(c.rent_amount, "money") : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("period")}</dt>
                      <dd className="text-foreground">
                        {day(c.lease_start)} – {day(c.lease_end)}
                      </dd>
                    </div>
                  </dl>

                  {ledgers.has(c.id) && <TenantLedger contractId={c.id} data={ledgers.get(c.id)!} ath={athByLease.get(c.id) ?? null} money={money} day={day} t={t} />}

                  <PortalLeaseExtras
                    contractId={c.id}
                    canRequest={c.status === "signed"}
                    requests={requestsByLease.get(c.id) ?? []}
                    inspections={inspectionsByLease.get(c.id) ?? []}
                  />

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {pending ? (
                      <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link href={`/portal/sign/${c.id}`}>
                          <PenLine aria-hidden />
                          {t("actions.sign")}
                        </Link>
                      </Button>
                    ) : c.status === "signed" && c.pdf_url ? (
                      <>
                        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                          <Link href={`/portal/sign/${c.id}`}>
                            <Eye aria-hidden />
                            {t("actions.view")}
                          </Link>
                        </Button>
                        <Button asChild size="lg" className="w-full sm:w-auto">
                          <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" download>
                            <Download aria-hidden />
                            {t("actions.download")}
                          </a>
                        </Button>
                      </>
                    ) : (
                      <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                        <Link href={`/portal/sign/${c.id}`}>
                          {c.status === "signed" ? <FileSignature aria-hidden /> : <Eye aria-hidden />}
                          {t("actions.view")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function TenantLedger({
  contractId,
  data,
  ath,
  money,
  day,
  t,
}: {
  contractId: string;
  data: { summary: LedgerSummary; payments: Payment[] };
  ath: AthOffer | null;
  money: (n: number) => string;
  day: (d: string | null) => string;
  t: Awaited<ReturnType<typeof getTranslations<"portal">>>;
}) {
  const s = data.summary;
  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("ledger.balance")}</dt>
          <dd className="tabular font-semibold text-foreground">{s.balance > 0 ? money(s.balance) : t("ledger.paidUp")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("ledger.overdue")}</dt>
          <dd className={s.overdue > 0 ? "tabular font-semibold text-danger" : "tabular text-foreground"}>{s.overdue > 0 ? money(s.overdue) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("ledger.nextDue")}</dt>
          <dd className="tabular text-foreground">{s.nextDue ? `${day(s.nextDue.date)} · ${money(s.nextDue.amount)}` : "—"}</dd>
        </div>
      </dl>
      {ath && (s.balance >= 1 || ath.pending) && (
        <AthPay contractId={contractId} balance={s.balance} defaultPhone={ath.phone} business={ath.business} pending={ath.pending} />
      )}
      <div>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground">{t("ledger.payments")}</h4>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ledger.noPayments")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="tabular">
                  {day(p.received_on)} · {money(Number(p.amount))}
                  {p.source === "ath_movil" && <span className="text-muted-foreground"> · ATH Móvil</span>}
                </span>
                <a href={`/api/portal/payments/${p.id}/receipt`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  <Receipt className="size-3.5" aria-hidden /> {t("ledger.receipt", { number: receiptNumber(p.number) })}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
