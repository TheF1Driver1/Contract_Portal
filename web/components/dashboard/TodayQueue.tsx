import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarClock, CheckCircle2, FileEdit, RefreshCw, Send, Wrench, type LucideIcon } from "lucide-react";
import type { MaintenanceUrgency } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QueueItem =
  | { kind: "draft"; contractId: string; title: string }
  | { kind: "unsigned"; contractId: string; title: string; days: number }
  | { kind: "expiring"; contractId: string; title: string; days: number }
  | { kind: "failed"; contractId: string; title: string; channel: string }
  | { kind: "maintenance"; requestId: string; title: string; property: string; urgency: MaintenanceUrgency; days: number }
  | { kind: "renewal"; contractId: string; title: string; days: number };

const KIND: Record<QueueItem["kind"], { icon: LucideIcon; tone: string; action: "send" | "remind" | "renew" | "review" | "attend" }> = {
  maintenance: { icon: Wrench, tone: "bg-danger-soft text-danger", action: "attend" },
  renewal: { icon: RefreshCw, tone: "bg-info-soft text-info", action: "renew" },
  failed: { icon: AlertTriangle, tone: "bg-danger-soft text-danger", action: "review" },
  expiring: { icon: CalendarClock, tone: "bg-warning-soft text-warning", action: "renew" },
  unsigned: { icon: Send, tone: "bg-info-soft text-info", action: "remind" },
  draft: { icon: FileEdit, tone: "bg-surface-muted text-muted-foreground", action: "send" },
};

const MAX_ITEMS = 8;

/** "Hoy": actionable contract items, most urgent first. */
export async function TodayQueue({ items }: { items: QueueItem[] }) {
  const t = await getTranslations("dashboard.today");
  const tm = await getTranslations("maintenance.alerts");
  const shown = items.slice(0, MAX_ITEMS);
  const hidden = items.length - shown.length;

  function detail(item: QueueItem) {
    switch (item.kind) {
      case "draft":
        return t("draft");
      case "unsigned":
        return t("unsigned", { days: item.days });
      case "expiring":
        return t("expiring", { days: item.days });
      case "failed":
        return t("failed", { channel: item.channel === "sms" ? "SMS" : item.channel });
      case "maintenance":
        return tm(item.urgency === "emergency" ? "emergency" : "urgent", { days: item.days, property: item.property });
      case "renewal":
        return tm("renewal", { days: item.days });
    }
  }

  return (
    <section aria-labelledby="today-title" className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="today-title" className="text-base font-semibold text-foreground">
          {t("title")}
        </h2>
        {items.length > 0 && <span className="text-sm text-muted-foreground">{t("count", { count: items.length })}</span>}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-success-soft p-4">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">{t("allClear")}</p>
            <p className="text-sm text-muted-foreground">{t("allClearDescription")}</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((item) => {
            const { icon: Icon, tone, action } = KIND[item.kind];
            const verb = action === "attend" ? tm("action") : t(`action.${action}`);
            const href = item.kind === "maintenance" ? `/maintenance/${item.requestId}` : `/contracts/${item.contractId}`;
            return (
              <li key={`${item.kind}-${href}-${"channel" in item ? item.channel : ""}`} className="flex items-center gap-3 py-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title || t("untitled")}</p>
                  <p className="truncate text-sm text-muted-foreground">{detail(item)}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="h-10 shrink-0 sm:h-8">
                  <Link href={href} aria-label={`${verb}: ${item.title || t("untitled")}`}>
                    {verb}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <Link href="/contracts" className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">
          {t("more", { count: hidden })}
        </Link>
      )}
    </section>
  );
}
