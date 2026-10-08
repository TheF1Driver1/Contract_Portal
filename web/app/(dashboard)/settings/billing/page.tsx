"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Check, CreditCard, Minus, Users } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import type { SubscriptionPlan } from "@/lib/types";
import { PLAN_LIMITS } from "@/lib/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { cn } from "@/lib/utils";
import { ReferralCard } from "@/components/referrals/ReferralCard";
import BillingLoading from "./loading";

const PLANS: SubscriptionPlan[] = ["free", "propietario", "inversionista", "enterprise"];
const RANK: Record<SubscriptionPlan, number> = { free: 0, propietario: 1, inversionista: 2, enterprise: 3 };
const CHECKOUT_PLANS: SubscriptionPlan[] = ["propietario", "inversionista"];

/** Feature keys (messages billing.compare.*) included per plan. */
const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  free: ["oneProperty", "threeContracts"],
  propietario: ["fiveProperties", "unlimitedContracts", "sms", "expenseCsv", "prContract", "market"],
  inversionista: ["unlimitedProperties", "scheduleE", "portfolio", "threeManagers", "prioritySupport"],
  enterprise: ["unlimitedProperties", "scheduleE", "unlimitedManagers"],
};

function isPlan(v: string | null): v is SubscriptionPlan {
  return !!v && (PLANS as string[]).includes(v);
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const searchParams = useSearchParams();
  const requested = searchParams.get("plan");
  const requestedPlan = isPlan(requested) ? requested : null;

  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [propertyCount, setPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{ yearly: boolean; trialDays: number }>({ yearly: false, trialDays: 0 });
  const [interval, setBillingInterval] = useState<"month" | "year">("month");
  const requestedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).single(),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      ]);

      if (profile?.plan) setPlan(profile.plan as SubscriptionPlan);
      setPropertyCount(count ?? 0);
      setLoading(false);
    }
    load();
    fetch("/api/billing/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOptions(o))
      .catch(() => {});
  }, []);

  // Arriving from /pricing with ?plan=: bring that plan's card into view.
  useEffect(() => {
    if (!loading && requestedPlan) requestedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, requestedPlan]);

  if (loading) return <BillingLoading />;

  const limits = PLAN_LIMITS[plan];
  const fmtMax = (n: number) => (n === Infinity ? t("unlimited") : String(n));
  const propertiesOver = limits.max_properties !== Infinity && propertyCount >= limits.max_properties;

  const usage = [
    {
      key: "properties",
      label: t("usage.properties"),
      value: `${propertyCount} / ${fmtMax(limits.max_properties)}`,
      note: propertiesOver ? t("usage.limitReached") : null,
    },
    {
      key: "contracts",
      label: t("usage.contracts"),
      value: limits.max_contracts_per_month === Infinity ? t("unlimited") : t("usage.perMonth", { count: limits.max_contracts_per_month }),
      note: null,
    },
    { key: "sms", label: t("usage.sms"), included: limits.sms },
    { key: "scheduleE", label: t("usage.scheduleE"), included: limits.schedule_e },
    {
      key: "managers",
      label: t("usage.managers"),
      value: limits.managers === 0 ? t("usage.notIncluded") : t("usage.upTo", { max: fmtMax(limits.managers) }),
      note: null,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <SectionHeader title={t("title")} description={t("description")} />

      {/* Current plan */}
      <Card className="gap-5 py-4 md:py-5">
        <CardHeader className="px-4 md:px-5">
          <CardDescription>{t("currentPlan")}</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            <h3>{t(`plans.${plan}.name`)}</h3>
            <Badge variant="secondary" className="tabular">{t(`plans.${plan}.price`)}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t(`plans.${plan}.description`)}</p>
        </CardHeader>
        <CardContent className="px-4 md:px-5">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {usage.map((u) => (
              <div
                key={u.key}
                className={cn(
                  "rounded-lg border bg-surface-muted p-3",
                  "note" in u && u.note ? "border-danger" : "border-border"
                )}
              >
                <dt className="text-xs font-medium text-muted-foreground">{u.label}</dt>
                <dd className="mt-1 text-base font-semibold text-foreground tabular">
                  {"included" in u ? (
                    <span className={cn("inline-flex items-center gap-1", u.included ? "text-success" : "text-muted-foreground")}>
                      {u.included ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                      {u.included ? t("usage.included") : t("usage.notIncluded")}
                    </span>
                  ) : (
                    u.value
                  )}
                </dd>
                {"note" in u && u.note && <p className="mt-1 text-xs font-medium text-danger">{u.note}</p>}
              </div>
            ))}
          </dl>
        </CardContent>
        {plan !== "free" && (
          <CardFooter className="flex-col items-stretch gap-2 border-t px-4 pt-4 sm:flex-row sm:items-center sm:justify-between md:px-5 [.border-t]:pt-4">
            <p className="text-sm text-muted-foreground">{t("manageHint")}</p>
            <Button asChild variant="outline" className="h-10 sm:h-9">
              {/* Plain navigation (GET) to the Stripe customer portal redirect. */}
              <a href="/api/billing/portal">
                <CreditCard aria-hidden />
                {t("manage")}
              </a>
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Plan comparison */}
      <section aria-labelledby="compare-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="compare-title" className="text-base font-semibold text-foreground">{t("compareTitle")}</h3>
          {options.yearly && (
            <div role="radiogroup" aria-label={t("interval.label")} className="inline-flex rounded-lg border bg-surface-muted p-0.5">
              {(["month", "year"] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={interval === i}
                  onClick={() => setBillingInterval(i)}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                    interval === i ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`interval.${i}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        {plan === "free" && options.trialDays > 0 && (
          <p className="text-sm text-muted-foreground">{t("trial", { days: options.trialDays })}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const isCurrent = p === plan;
            const isRequested = p === requestedPlan && !isCurrent;
            const canUpgrade = CHECKOUT_PLANS.includes(p) && RANK[p] > RANK[plan];
            return (
              <div key={p} ref={isRequested ? requestedRef : undefined}>
                <Card
                  className={cn(
                    "h-full gap-4 py-4 md:py-5",
                    isCurrent && "border-primary",
                    isRequested && "ring-2 ring-ring"
                  )}
                >
                  <CardHeader className="px-4 md:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        <h4>{t(`plans.${p}.name`)}</h4>
                      </CardTitle>
                      {isCurrent && <Badge className="bg-primary-soft text-primary-soft-foreground">{t("yourPlan")}</Badge>}
                      {isRequested && <Badge variant="outline">{t("selected")}</Badge>}
                    </div>
                    <p className="text-lg font-semibold text-foreground tabular">
                      {interval === "year" && CHECKOUT_PLANS.includes(p) ? t("interval.billedYearly") : t(`plans.${p}.price`)}
                    </p>
                    <CardDescription>{t(`plans.${p}.description`)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 px-4 md:px-5">
                    <ul className="space-y-2">
                      {PLAN_FEATURES[p].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                          {t(`compare.${f}`)}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  {canUpgrade && (
                    <CardFooter className="px-4 md:px-5">
                      <form action="/api/billing/checkout" method="post" className="w-full">
                        <input type="hidden" name="plan" value={p} />
                        <input type="hidden" name="interval" value={interval} />
                        <Button
                          type="submit"
                          className="h-10 w-full sm:h-9"
                          variant={p === "inversionista" || isRequested ? "default" : "outline"}
                        >
                          {t("upgradeTo", { plan: t(`plans.${p}.name`) })}
                          <ArrowUpRight aria-hidden />
                        </Button>
                      </form>
                    </CardFooter>
                  )}
                  {p === "enterprise" && !isCurrent && (
                    <CardFooter className="px-4 md:px-5">
                      <Button asChild variant="outline" className="h-10 w-full sm:h-9">
                        <Link href="/contacto">{t("enterpriseCta")}</Link>
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      {/* Referral loop (Plan 37) */}
      <ReferralCard />

      {/* Managers shortcut */}
      {(plan === "inversionista" || plan === "enterprise") && (
        <Link
          href="/settings/managers"
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover md:p-5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Users className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("managersTitle")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("managersBody")}</p>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <p className="text-xs text-muted-foreground">{t("legal")}</p>
    </div>
  );
}
