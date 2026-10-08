"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowUpRight, Building2, Download, FileText, Info, Lock } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { SegmentedControl } from "@/components/settings/SegmentedControl";
import { ReviewNotice } from "@/components/tax/ReviewNotice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupLines, type AnnualPackage, type AnnualProperty, type GroupedLine, type TaxView } from "@/lib/tax/annual";
import type { TaxResidency } from "@/lib/db";
import { cn } from "@/lib/utils";

const ALL = "all";

export function AnnualPackageView({
  pkg,
  properties,
  years,
  propertyId,
  view,
  residency,
  canExport,
}: {
  pkg: AnnualPackage;
  properties: { id: string; name: string }[];
  years: number[];
  propertyId: string | null;
  view: TaxView;
  residency: TaxResidency | null;
  canExport: boolean;
}) {
  const t = useTranslations("tax.annual");
  const tt = useTranslations("tax");
  const f = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "medium" });
  const year = pkg.year;

  const params = (over: Partial<{ year: string; property: string | null; view: TaxView }>) => {
    const q = new URLSearchParams();
    q.set("year", over.year ?? String(year));
    const prop = over.property === undefined ? propertyId : over.property;
    if (prop) q.set("property", prop);
    q.set("view", over.view ?? view);
    return q.toString();
  };
  const go = (over: Parameters<typeof params>[0]) => startTransition(() => router.push(`/reports/annual?${params(over)}`));
  const exportHref = (format: "csv" | "pdf") => `/api/reports/annual?${params({})}&format=${format}`;

  const lineLabel = (g: GroupedLine) => (view === "schedule_e" ? tt(`scheduleE.${g.scheduleE}` as "scheduleE.3") : tt(`anejoN.${g.anejoN}`));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canExport ? (
            <>
              <Button asChild variant="outline" className="h-10 md:h-9">
                <a href={exportHref("csv")} download>
                  <Download />
                  {t("csv")}
                </a>
              </Button>
              <Button asChild className="h-10 md:h-9">
                <a href={exportHref("pdf")} download>
                  <Download />
                  {t("pdf")}
                </a>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="h-10 md:h-9">
              <Link href="/pricing">
                <Lock />
                {t("exportLocked")}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-[auto_minmax(0,16rem)_1fr]">
        <div className="space-y-2">
          <Label htmlFor="annual-year">{t("year")}</Label>
          <Select value={String(year)} onValueChange={(v) => go({ year: v })}>
            <SelectTrigger id="annual-year" className="h-10 w-full tabular sm:w-28 md:h-9">
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
        <div className="space-y-2">
          <Label htmlFor="annual-property">{t("property")}</Label>
          <Select value={propertyId ?? ALL} onValueChange={(v) => go({ property: v === ALL ? null : v })}>
            <SelectTrigger id="annual-property" className="h-10 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allProperties")}</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <span className="block text-sm font-medium" id="annual-view-label">
            {t("view")}
          </span>
          <SegmentedControl
            label={t("view")}
            value={view}
            onChange={(v) => go({ view: v as TaxView })}
            options={[
              { value: "anejo_n", label: t("viewAnejo") },
              { value: "schedule_e", label: t("viewScheduleE") },
            ]}
          />
        </div>
      </div>

      {view === "anejo_n" ? <ReviewNotice /> : <ReviewNotice compact />}

      {view === "schedule_e" && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-info-soft p-4 sm:flex-row sm:items-center md:p-5">
          <FileText className="size-4 shrink-0 text-info" aria-hidden />
          <p className="flex-1 text-sm text-foreground">{residency === "non_resident" ? t("scheduleENonResident") : t("scheduleEHint")}</p>
          <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
            <Link href={`/reports/schedule-e?year=${year}`}>
              {t("scheduleELink")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}

      {pkg.properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href="/properties">{t("empty.action")}</Link>
            </Button>
          }
        />
      ) : (
        <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-5 md:p-5">
            <Kpi label={t("totals.income")} value={money(pkg.income)} />
            <Kpi label={t("totals.expenses")} value={money(pkg.expenses)} />
            <Kpi label={t("totals.net")} value={money(pkg.net)} danger={pkg.net < 0} />
            <Kpi label={t("totals.depreciation")} value={money(pkg.depreciation)} />
            <Kpi label={t("totals.netAfter")} value={money(pkg.netAfterDepreciation)} danger={pkg.netAfterDepreciation < 0} />
          </dl>
          {pkg.hasEstimates && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("estimatesHint")}
            </p>
          )}

          {pkg.properties.map((p) => (
            <PropertyCard key={p.id} p={p} view={view} year={year} money={money} date={date} lineLabel={lineLabel} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 md:p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("disclaimer.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("disclaimer.body")}</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 truncate text-lg font-semibold", danger ? "text-danger" : "text-foreground")}>{value}</dd>
    </div>
  );
}

function PropertyCard({
  p,
  view,
  year,
  money,
  date,
  lineLabel,
}: {
  p: AnnualProperty;
  view: TaxView;
  year: number;
  money: (n: number) => string;
  date: (d: string) => string;
  lineLabel: (g: GroupedLine) => string;
}) {
  const t = useTranslations("tax.annual");
  const groups = groupLines(p.lines, view);
  const se = view === "schedule_e";
  const pad = "px-4 md:px-5";

  return (
    <section aria-labelledby={`annual-${p.id}`} className="rounded-xl border border-border bg-surface py-4 md:py-5">
      <div className={cn("mb-3", pad)}>
        <h2 id={`annual-${p.id}`} className="text-base font-semibold text-foreground">
          {p.name}
        </h2>
        {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
        <p className="mt-2 text-sm text-muted-foreground">{t(`source.${p.incomeSource}`, { year })}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {se && <TableHead className="w-16 pl-4 md:pl-5">{t("table.line")}</TableHead>}
            <TableHead className={se ? undefined : "pl-4 md:pl-5"}>{se ? t("table.concept") : t("table.group")}</TableHead>
            <TableHead className="pr-4 text-right md:pr-5">{t("table.amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={se ? 3 : 2} className="whitespace-normal px-4 text-sm text-muted-foreground md:px-5">
                {t("table.noLines", { year })}
              </TableCell>
            </TableRow>
          ) : (
            groups.map((g) => (
              <TableRow key={g.key}>
                {se && <TableCell className="pl-4 text-muted-foreground tabular md:pl-5">{g.scheduleE}</TableCell>}
                <TableCell className={cn("whitespace-normal", !se && "pl-4 md:pl-5")}>
                  {lineLabel(g)}
                  {g.estimated && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("estimated")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular pr-4 text-right md:pr-5">{money(g.amount)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={se ? 2 : 1} className="pl-4 md:pl-5">
              {t("table.totalExpenses")}
            </TableCell>
            <TableCell className="tabular pr-4 text-right md:pr-5">{money(p.expenses)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={se ? 2 : 1} className="pl-4 font-semibold md:pl-5">
              {t("table.net")}
            </TableCell>
            <TableCell className={cn("tabular pr-4 text-right font-semibold md:pr-5", p.net < 0 ? "text-danger" : "text-foreground")}>{money(p.net)}</TableCell>
          </TableRow>
          {p.depreciation && p.depreciation.annual > 0 && (
            <TableRow>
              <TableCell colSpan={se ? 2 : 1} className="whitespace-normal pl-4 md:pl-5">
                {t("table.netAfter")}
              </TableCell>
              <TableCell className={cn("tabular pr-4 text-right md:pr-5", p.netAfterDepreciation < 0 ? "text-danger" : "text-foreground")}>
                {money(p.netAfterDepreciation)}
              </TableCell>
            </TableRow>
          )}
        </TableFooter>
      </Table>

      <div className={cn("mt-4 space-y-2 text-sm text-muted-foreground", pad)}>
        {p.crimPaid > 0 && <p>{t("crimPaidNote", { year, amount: money(p.crimPaid) })}</p>}
        <div className="rounded-lg bg-surface-muted p-3">
          <p className="font-medium text-foreground">{t("depreciation.title")}</p>
          {p.depreciation ? (
            <>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <div>
                  <dt className="text-xs">{t("depreciation.purchase")}</dt>
                  <dd className="tabular text-foreground">{money(p.depreciation.purchasePrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs">{t("depreciation.buildingPct")}</dt>
                  <dd className="tabular text-foreground">{p.depreciation.buildingPct}%</dd>
                </div>
                <div>
                  <dt className="text-xs">{t("depreciation.placedInService")}</dt>
                  <dd className="text-foreground">{date(p.depreciation.placedInService)}</dd>
                </div>
                <div>
                  <dt className="text-xs">{t("depreciation.basis")}</dt>
                  <dd className="tabular text-foreground">{money(p.depreciation.basis)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs">{t("depreciation.hint")}</p>
            </>
          ) : (
            <p className="mt-1">{t("depreciation.missing")}</p>
          )}
          <Link href={`/properties?crim=${p.id}`} className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
            {t("depreciation.edit")}
          </Link>
        </div>
      </div>
    </section>
  );
}
