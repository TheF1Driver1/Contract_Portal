"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellOff, Mail, MessageSquare } from "lucide-react";
import type { ContractNotificationLog } from "@/lib/types";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function NotificationPanel({
  contractId,
  initialSuppressed,
  initialLogs,
}: {
  contractId: string;
  initialSuppressed: boolean;
  initialLogs: ContractNotificationLog[];
}) {
  const t = useTranslations("contracts.notifications");
  const tc = useTranslations("common");
  // remindersOn = true means notifications are ENABLED (suppress_notifications = false in DB)
  const [remindersOn, setRemindersOn] = useState(!initialSuppressed);
  const [toggling, setToggling] = useState(false);
  const logs = initialLogs;

  async function handleToggle(next: boolean) {
    setToggling(true);
    setRemindersOn(next);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppress_notifications: !next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? t("enabled") : t("disabled"));
    } catch {
      setRemindersOn(!next);
      toast.error(tc("saveFailed"));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="contract-reminders">{t("reminders")}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{remindersOn ? t("remindersOn") : t("remindersOff")}</p>
        </div>
        <Switch
          id="contract-reminders"
          checked={remindersOn}
          onCheckedChange={handleToggle}
          disabled={toggling}
        />
      </div>

      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold text-foreground">{t("history")}</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: ContractNotificationLog }) {
  const t = useTranslations("contracts.notifications");
  const f = useFormatter();
  const Icon = log.channel === "sms" ? MessageSquare : Mail;
  const label = log.days_before === 0 ? t("manual") : t("daysBefore", { count: log.days_before });

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={t(`channel.${log.channel}`)} />
        <span className="truncate text-muted-foreground" title={log.error_message ?? undefined}>
          {label}
        </span>
        {log.status === "suppressed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <BellOff className="size-3.5" aria-hidden />
            {t("suppressed")}
          </span>
        ) : (
          <StatusBadge status={log.status} />
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {f.dateTime(new Date(log.sent_at), { dateStyle: "medium" })}
      </span>
    </li>
  );
}
