"use client";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Clock } from "lucide-react";
import { dataFreshness } from "@/lib/market/comps";
import { cn } from "@/lib/utils";

/**
 * "Datos actualizados hace N días", or a warning once the data is older than
 * STALE_AFTER_DAYS. Renders nothing when the date is unknown.
 */
export function MarketFreshness({ updatedAt, className }: { updatedAt: string | null | undefined; className?: string }) {
  const t = useTranslations("market.freshness");
  const f = useFormatter();
  const fresh = dataFreshness(updatedAt);
  if (!fresh || !updatedAt) return null;

  const title = t("title", { date: f.dateTime(new Date(updatedAt), { dateStyle: "medium", timeStyle: "short" }) });
  if (fresh.stale) {
    return (
      <p
        role="status"
        title={title}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-warning",
          className
        )}
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        {t("stale", { count: fresh.days })}
      </p>
    );
  }
  return (
    <p title={title} className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Clock className="size-3.5 shrink-0" aria-hidden />
      {t("updated", { count: fresh.days })}
    </p>
  );
}
