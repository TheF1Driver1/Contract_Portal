import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { getAlerts } from "@/lib/alerts";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { RentExpenseChart } from "@/components/LazyCharts";
import { TodayQueue, type QueueItem } from "@/components/dashboard/TodayQueue";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import type { RentExpensePoint } from "@/components/dashboard/RentExpenseChart";

type ContractRow = {
  id: string;
  status: string;
  rent_amount: number;
  lease_start: string;
  lease_end: string;
  created_at: string;
  property_id: string;
  property: { name: string } | null;
  tenant: { full_name: string } | null;
};

const DAY_MS = 86_400_000;
const EXPIRING_WINDOW_DAYS = 60;

/** Whole days from a to b (YYYY-MM-DD strings). */
function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const f = await getFormatter();

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentMonth = todayIso.slice(0, 7);

  // Last 12 months including the current one, oldest first.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 15, 12));
    return { key: d.toISOString().slice(0, 7), date: d };
  });
  const windowStart = `${months[0].key}-01`;
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  const [{ data: monthCharges }, { data: monthPayments }] = await Promise.all([
    supabase.from("rent_charges").select("amount").eq("owner_id", user!.id).is("voided_at", null).gte("due_date", `${currentMonth}-01`).lt("due_date", nextMonth),
    supabase.from("payments").select("amount").eq("owner_id", user!.id).is("voided_at", null).gte("received_on", `${currentMonth}-01`).lt("received_on", nextMonth),
  ]);
  const ledgerExpected = (monthCharges ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const ledgerCollected = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const [contractsResult, propertiesResult, expensesResult, alerts, tenantsCount] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, status, rent_amount, lease_start, lease_end, created_at, property_id, property:properties(name), tenant:tenants(full_name)"
      )
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id, unit_count").eq("owner_id", user!.id),
    supabase
      .from("property_expenses")
      .select("amount, expense_date")
      .eq("user_id", user!.id)
      .gte("expense_date", windowStart)
      .lt("expense_date", nextMonth),
    getAlerts(supabase, now),
    supabase.from("tenants").select("id", { count: "exact", head: true }),
  ]);

  const contracts = (contractsResult.data ?? []) as unknown as ContractRow[];
  const properties = (propertiesResult.data ?? []) as { id: string; unit_count: number | null }[];
  const expenses = (expensesResult.data ?? []) as { amount: number; expense_date: string }[];

  const titleOf = (c: ContractRow) => [c.tenant?.full_name, c.property?.name].filter(Boolean).join(" · ");
  const byId = new Map(contracts.map((c) => [c.id, c]));

  const signed = contracts.filter((c) => c.status === "signed" && c.lease_start && c.lease_end);
  const drafts = contracts.filter((c) => c.status === "draft");

  // ── KPIs ──
  const coversMonth = (c: ContractRow, key: string) => c.lease_start.slice(0, 7) <= key && key <= c.lease_end.slice(0, 7);
  const thisMonthLeases = signed.filter((c) => coversMonth(c, currentMonth));
  const expectedRent = thisMonthLeases.reduce((s, c) => s + Number(c.rent_amount ?? 0), 0);

  const activeByProperty = new Map<string, number>();
  for (const c of signed) {
    if (c.lease_start.slice(0, 10) <= todayIso && todayIso <= c.lease_end.slice(0, 10)) {
      activeByProperty.set(c.property_id, (activeByProperty.get(c.property_id) ?? 0) + 1);
    }
  }
  let totalUnits = 0;
  let occupiedUnits = 0;
  for (const p of properties) {
    const units = Math.max(1, p.unit_count ?? 1);
    totalUnits += units;
    occupiedUnits += Math.min(units, activeByProperty.get(p.id) ?? 0);
  }
  const occupancy = totalUnits > 0 ? occupiedUnits / totalUnits : null;

  const expiringCount = signed.filter((c) => {
    const days = dayDiff(todayIso, c.lease_end);
    return days >= 0 && days <= EXPIRING_WINDOW_DAYS;
  }).length;

  // ── "Hoy" queue, most urgent first: failed sends, leases ending ≤14 days,
  // unsigned (oldest first), drafts, then the rest of the expiring leases.
  const failed: QueueItem[] = [];
  const seenFailed = new Set<string>();
  const expiringSoon: QueueItem[] = [];
  const expiringLater: QueueItem[] = [];
  const unsigned: QueueItem[] = [];
  const crimDue: QueueItem[] = [];
  const repairs: QueueItem[] = []; // Plan 36: open urgent/emergency maintenance
  const renewals: QueueItem[] = []; // Plan 36: leases ending in 60–90 days with no renewal
  for (const a of alerts) {
    if (a.kind === "crim") {
      crimDue.push(a);
      continue;
    }
    if (a.kind === "failed") {
      const key = `${a.contractId}:${a.channel}`;
      if (seenFailed.has(key)) continue;
      seenFailed.add(key);
      const c = byId.get(a.contractId);
      failed.push({ kind: "failed", contractId: a.contractId, title: c ? titleOf(c) : "", channel: a.channel });
    } else if (a.kind === "expiring") {
      (a.days <= 14 ? expiringSoon : expiringLater).push(a);
    } else if (a.kind === "maintenance") {
      repairs.push({ kind: "maintenance", requestId: a.requestId, title: a.title, property: a.property, urgency: a.urgency, days: a.days });
    } else if (a.kind === "renewal") {
      renewals.push(a);
    } else {
      unsigned.push(a);
    }
  }
  unsigned.sort((a, b) => ("days" in b ? b.days : 0) - ("days" in a ? a.days : 0));
  const queue: QueueItem[] = [
    ...repairs,
    ...failed,
    ...expiringSoon,
    ...crimDue,
    ...unsigned,
    ...drafts.map((c): QueueItem => ({ kind: "draft", contractId: c.id, title: titleOf(c) })),
    ...expiringLater,
    ...renewals,
  ];

  // ── Chart: expected rent vs expenses per month ──
  const chartData: RentExpensePoint[] = months.map(({ key, date }) => ({
    key,
    label: f.dateTime(date, { month: "short" }),
    fullLabel: f.dateTime(date, { month: "long", year: "numeric" }),
    rent: signed.filter((c) => coversMonth(c, key)).reduce((s, c) => s + Number(c.rent_amount ?? 0), 0),
    expenses: 0,
  }));
  const monthIndex = new Map(chartData.map((m, i) => [m.key, i]));
  for (const e of expenses) {
    const i = monthIndex.get(e.expense_date?.slice(0, 7));
    if (i !== undefined) chartData[i].expenses += Number(e.amount ?? 0);
  }
  const totalRent = chartData.reduce((s, m) => s + m.rent, 0);
  const totalExpenses = chartData.reduce((s, m) => s + m.expenses, 0);
  const hasChartData = totalRent > 0 || totalExpenses > 0;

  const kpis = [
    // With rent tracking on, show money actually received rather than lease totals.
    ledgerExpected > 0
      ? {
          label: t("kpi.collected"),
          value: f.number(ledgerCollected, "money"),
          sub: t("kpi.collectedSub", { expected: f.number(ledgerExpected, "money") }),
          href: "/rent",
        }
      : {
          label: t("kpi.expectedRent"),
          value: f.number(expectedRent, "money"),
          sub: t("kpi.expectedRentSub", { count: thisMonthLeases.length }),
        },
    {
      label: t("kpi.occupancy"),
      value: occupancy === null ? "—" : f.number(occupancy, { style: "percent", maximumFractionDigits: 0 }),
      sub: occupancy === null ? t("kpi.occupancyNone") : t("kpi.occupancySub", { occupied: occupiedUnits, total: totalUnits }),
      href: "/properties",
    },
    { label: t("kpi.expiring"), value: f.number(expiringCount), sub: t("kpi.expiringSub"), href: "/contracts" },
    { label: t("kpi.drafts"), value: f.number(drafts.length), sub: t("kpi.draftsSub"), href: "/contracts" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild className="h-10 sm:h-9">
            <Link href="/contracts/new">
              <Plus aria-hidden />
              {t("newContract")}
            </Link>
          </Button>
        }
      />

      <GettingStarted
        progress={{
          property: properties.length > 0,
          tenant: (tenantsCount.count ?? 0) > 0,
          contract: contracts.length > 0,
          sent: contracts.some((c) => c.status !== "draft"),
          signed: contracts.some((c) => c.status === "signed"),
        }}
      />

      <TodayQueue items={queue} />

      {/* KPI row */}
      <section aria-label={t("kpi.label")} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-foreground">{k.value}</p>
              <p className="mt-1 text-xs text-subtle-foreground">{k.sub}</p>
            </>
          );
          const cls = "block rounded-xl border border-border bg-surface p-4 md:p-5";
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${cls} transition-colors hover:bg-surface-hover`}>
              {body}
            </Link>
          ) : (
            <div key={k.label} className={cls}>
              {body}
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 12-month chart */}
        <section
          aria-labelledby="chart-title"
          className="rounded-xl border border-border bg-surface p-4 md:p-5 lg:col-span-2"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="chart-title" className="text-base font-semibold text-foreground">
                {t("chart.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("chart.description")}</p>
            </div>
            <ul className="flex shrink-0 gap-4 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
                {t("chart.rent")}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm bg-chart-3" aria-hidden />
                {t("chart.expenses")}
              </li>
            </ul>
          </div>

          {hasChartData ? (
            <>
              <p className="sr-only">
                {t("chart.summary", { rent: f.number(totalRent, "money"), expenses: f.number(totalExpenses, "money") })}
              </p>
              <RentExpenseChart data={chartData} />
              <table className="sr-only">
                <caption>{t("chart.title")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("chart.month")}</th>
                    <th scope="col">{t("chart.rent")}</th>
                    <th scope="col">{t("chart.expenses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((m) => (
                    <tr key={m.key}>
                      <th scope="row">{m.fullLabel}</th>
                      <td>{f.number(m.rent, "money")}</td>
                      <td>{f.number(m.expenses, "money")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="flex h-40 items-center justify-center rounded-lg bg-surface-muted px-4 text-center text-sm text-muted-foreground">
              {t("chart.empty")}
            </p>
          )}
        </section>

        {/* Recent contracts */}
        <section aria-labelledby="recent-title" className="rounded-xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="recent-title" className="text-base font-semibold text-foreground">
              {t("recent.title")}
            </h2>
            {contracts.length > 0 && (
              <Link
                href="/contracts"
                className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("viewAll")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>

          {contracts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("recent.empty")}
              description={t("recent.emptyDescription")}
              action={
                <Button asChild>
                  <Link href="/contracts/new">
                    <Plus aria-hidden />
                    {t("newContract")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="-mx-2">
              {contracts.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.tenant?.full_name ?? t("recent.unknownTenant")}
                        <span className="font-normal text-muted-foreground">
                          {" · "}
                          {c.property?.name ?? t("recent.noProperty")}
                        </span>
                      </p>
                      <p className="tabular text-sm text-muted-foreground">
                        {f.number(Number(c.rent_amount ?? 0), "money")}
                        {tc("perMonth")}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
