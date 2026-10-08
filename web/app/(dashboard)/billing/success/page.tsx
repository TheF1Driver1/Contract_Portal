"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Bell, Building2, CheckCircle2, CreditCard, FilePlus2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_STEPS = [
  { key: "property", href: "/properties", icon: Building2 },
  { key: "contract", href: "/contracts/new", icon: FilePlus2 },
  { key: "reminders", href: "/settings/notifications", icon: Bell },
  { key: "billing", href: "/settings/billing", icon: CreditCard },
] as const;

function SuccessContent() {
  const t = useTranslations("billing.success");
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"loading" | "done">(sessionId ? "loading" : "done");

  useEffect(() => {
    if (!sessionId) return;
    // Wait briefly: the Stripe webhook may take a few seconds to update the profile.
    const timer = setTimeout(() => setStatus("done"), 3000);
    return () => clearTimeout(timer);
  }, [sessionId]);

  const done = status === "done";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center md:py-16">
      <div
        className={
          done
            ? "mb-5 flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
            : "mb-5 flex size-14 items-center justify-center rounded-full bg-surface-muted text-muted-foreground"
        }
      >
        {done ? <CheckCircle2 className="size-7" aria-hidden /> : <Loader2 className="size-7 animate-spin" aria-hidden />}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground" aria-live="polite">
        {done ? t("doneTitle") : t("loadingTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{done ? t("doneBody") : t("loadingBody")}</p>

      {done && (
        <>
          <Card className="mt-8 w-full gap-0 py-2 text-left">
            <CardContent className="px-2">
              <h2 className="px-3 pt-2 pb-1 text-sm font-semibold text-foreground">{t("nextSteps")}</h2>
              <ul>
                {NEXT_STEPS.map(({ key, href, icon: Icon }) => (
                  <li key={key}>
                    <Link
                      href={href}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{t(`steps.${key}.title`)}</span>
                        <span className="block text-xs text-muted-foreground">{t(`steps.${key}.body`)}</span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Button asChild className="mt-6 h-10">
            <Link href="/dashboard">
              {t("goDashboard")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
