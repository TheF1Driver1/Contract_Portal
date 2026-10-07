"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, Bell, CalendarClock, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Alert } from "@/lib/alerts";

const ICON = { expiring: CalendarClock, unsigned: PenLine, failed: AlertTriangle } as const;
const TONE = { expiring: "text-warning", unsigned: "text-info", failed: "text-danger" } as const;

export function NotificationBell({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations("nav");
  const count = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t("notifications")} (${count})`}>
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-semibold leading-4 text-destructive-foreground tabular">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">{t("notifications")}</p>
        {count === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {alerts.map((a, i) => {
              const Icon = ICON[a.kind];
              const detail =
                a.kind === "expiring"
                  ? t("alertExpiring", { days: a.days })
                  : a.kind === "unsigned"
                    ? t("alertUnsigned", { days: a.days })
                    : t("alertFailed", { channel: a.channel.toUpperCase() });
              return (
                <li key={`${a.kind}-${a.contractId}-${i}`}>
                  <Link
                    href={`/contracts/${a.contractId}`}
                    className="flex gap-3 px-4 py-2.5 hover:bg-surface-hover"
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[a.kind]}`} />
                    <span className="min-w-0">
                      {a.title && <span className="block truncate text-sm">{a.title}</span>}
                      <span className="block text-xs text-muted-foreground">{detail}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
