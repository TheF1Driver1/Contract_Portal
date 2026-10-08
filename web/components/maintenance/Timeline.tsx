"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MaintenanceUpdate } from "@/lib/db";
import { cn } from "@/lib/utils";

/** Request history, oldest first. Shared by the landlord page and the tenant portal. */
export function Timeline({ updates }: { updates: Pick<MaintenanceUpdate, "id" | "author_kind" | "note" | "status_change" | "created_at">[] }) {
  const t = useTranslations("maintenance");
  const f = useFormatter();
  if (!updates.length) return <p className="text-sm text-muted-foreground">{t("timeline.empty")}</p>;
  return (
    <ol className="space-y-3">
      {updates.map((u, i) => {
        const expense = u.author_kind === "system" && u.note?.startsWith("expense:");
        const headline =
          u.status_change === "open" && i === 0
            ? t("timeline.opened")
            : u.status_change
              ? t("timeline.status", { status: t(`status.${u.status_change}`) })
              : expense
                ? t("timeline.expense")
                : null;
        return (
          <li key={u.id} className="flex gap-3">
            <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", u.status_change ? "bg-primary" : "bg-border-strong")} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-xs text-muted-foreground">
                {t(`timeline.author.${u.author_kind}`)} · {f.dateTime(new Date(u.created_at), { dateStyle: "medium", timeStyle: "short" })}
              </p>
              {headline && <p className="font-medium text-foreground">{headline}</p>}
              {u.note && !expense && <p className="whitespace-pre-line text-foreground">{u.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
