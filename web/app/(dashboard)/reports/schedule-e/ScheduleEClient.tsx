"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowUpRight, Building2, Check, Download, FileText, Info, Loader2, Lock } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/types";
import { PLAN_PRICES_USD, planDisplayName } from "@/lib/subscription";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScheduleESummary } from "@/components/reports/schedule-e-data";
import { cn } from "@/lib/utils";

const GATE_FEATURES = ["summary", "lines", "properties", "managers"] as const;
const MONEY = { style: "currency", currency: "USD" } as const;

export default function ScheduleEClient({
  plan,
  canExport,
  year,
  years,
  summary,
}: {
  plan: SubscriptionPlan;
  canExport: boolean;
  year: number;
  years: number[];
  summary: ScheduleESummary | null;
}) {
  const t = useTranslations("reports");
  const f = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const money = (n: number) => f.number(n, MONEY);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/schedule-e?year=${year}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(res.status === 404 ? t("noProperties") : typeof body.error === "string" ? body.error : t("downloadFailed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-e-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("downloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  // ── Upgrade gate ──────────────────────────────────────────────────────────
  if (!canExport) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />

        <Card className="items-center text-center">
          <CardHeader className="w-full justify-items-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <Lock className="size-5" aria-hidden />
            </div>
            <CardTitle className="text-lg">
              <h2>{t("gate.title")}</h2>
            </CardTitle>
            <CardDescription className="max-w-md">{t("gate.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex w-full flex-col items-center gap-5">
            <ul className="w-full max-w-sm space-y-2 text-left text-sm">
              {GATE_FEATURES.map((k) => (
                <li key={k} className="flex items-center gap-2.5 text-foreground">
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                  {t(`gate.features.${k}`)}
                </li>
              ))}
            </ul>
            <Button asChild size="lg">
              <Link href="/pricing">
                {t("gate.cta")}
                <ArrowUpRight />
              </Link>
            </Button>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="tabular">{t("gate.price", { price: PLAN_PRICES_USD.inversionista })}</p>
              <p>{t("gate.currentPlan", { plan: planDisplayName(plan) })}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border bg-surface p-4 md:p-5">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("gate.whatTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("gate.whatBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked view ─────────────────────────────────────────────────────────
  const props = summary?.properties ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor="schedule-e-year" className="sr-only">
                {t("year")}
              </Label>
              <Select
                value={String(year)}
                onValueChange={(v) => startTransition(() => router.push(`/reports/schedule-e?year=${v}`))}
              >
                <SelectTrigger id="schedule-e-year" className="h-10 w-28 tabular md:h-9">
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
            <Button onClick={handleDownload} disabled={downloading || props.length === 0} className="h-10 md:h-9">
              {downloading ? <Loader2 className="animate-spin" /> : <Download />}
              {downloading ? t("generating") : t("download", { year })}
            </Button>
          </>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border bg-info-soft p-4 md:p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("disclaimer.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("disclaimer.body")}</p>
        </div>
      </div>

      {props.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("emptyProperties.title")}
          description={t("emptyProperties.description")}
          action={
            <Button asChild>
              <Link href="/properties">{t("emptyProperties.action")}</Link>
            </Button>
          }
        />
      ) : (
        <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          <dl className="grid grid-cols-1 gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-3 md:p-5">
            <div>
              <dt className="text-xs text-muted-foreground">{t("totals.income")}</dt>
              <dd className="tabular mt-1 text-lg font-semibold text-foreground">{money(summary?.income ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("totals.expenses")}</dt>
              <dd className="tabular mt-1 text-lg font-semibold text-foreground">{money(summary?.expenses ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("totals.net")} · {t("totals.properties", { count: props.length })}
              </dt>
              <dd
                className={cn(
                  "tabular mt-1 text-lg font-semibold",
                  (summary?.net ?? 0) < 0 ? "text-danger" : "text-foreground"
                )}
              >
                {money(summary?.net ?? 0)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t("incomeHint")}</p>

          {props.map((p) => (
            <Card key={p.id} className="gap-4 py-4 md:py-5">
              <CardHeader className="px-4 md:px-5">
                <CardTitle className="text-base">
                  <h2>{p.name}</h2>
                </CardTitle>
                {p.address && <CardDescription>{p.address}</CardDescription>}
              </CardHeader>
              <CardContent className="px-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 pl-4 md:pl-5">{t("table.line")}</TableHead>
                      <TableHead>{t("table.concept")}</TableHead>
                      <TableHead className="pr-4 text-right md:pr-5">{t("table.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="pl-4 text-muted-foreground tabular md:pl-5">3</TableCell>
                      <TableCell>{t("table.income")}</TableCell>
                      <TableCell className="tabular pr-4 text-right md:pr-5">{money(p.income)}</TableCell>
                    </TableRow>
                    {p.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="whitespace-normal px-4 text-sm text-muted-foreground md:px-5">
                          {t("table.noExpenses", { year })}
                        </TableCell>
                      </TableRow>
                    ) : (
                      p.lines.map((l) => (
                        <TableRow key={l.line}>
                          <TableCell className="pl-4 text-muted-foreground tabular md:pl-5">{l.line}</TableCell>
                          <TableCell className="whitespace-normal">
                            {t.has(`lines.${l.line}`) ? t(`lines.${l.line}`) : t("lineNumber", { line: l.line })}
                          </TableCell>
                          <TableCell className="tabular pr-4 text-right md:pr-5">{money(l.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="pl-4 md:pl-5" />
                      <TableCell>{t("table.totalExpenses")}</TableCell>
                      <TableCell className="tabular pr-4 text-right md:pr-5">{money(p.expenses)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-4 md:pl-5" />
                      <TableCell className="font-semibold">{t("table.net")}</TableCell>
                      <TableCell
                        className={cn(
                          "tabular pr-4 text-right font-semibold md:pr-5",
                          p.net < 0 ? "text-danger" : "text-foreground"
                        )}
                      >
                        {money(p.net)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
