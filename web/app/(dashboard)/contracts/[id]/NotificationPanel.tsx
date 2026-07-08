"use client";

import { useState } from "react";
import { Mail, Bell, BellOff } from "lucide-react";
import type { ContractNotificationLog } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function NotificationPanel({
  contractId,
  initialSuppressed,
  initialLogs,
}: {
  contractId: string;
  initialSuppressed: boolean;
  initialLogs: ContractNotificationLog[];
}) {
  // remindersOn = true means notifications are ENABLED (suppress_notifications = false in DB)
  const [remindersOn, setRemindersOn]           = useState(!initialSuppressed);
  const [toggling, setToggling]                 = useState(false);
  const [logs]                                  = useState<ContractNotificationLog[]>(initialLogs);

  async function handleToggle() {
    setToggling(true);
    const next = !remindersOn;
    setRemindersOn(next);
    try {
      await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppress_notifications: !next }),
      });
    } catch {
      setRemindersOn(!next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Reminders toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {remindersOn
            ? <Bell    className="h-3.5 w-3.5" style={{ color: "var(--accent-color)" }} />
            : <BellOff className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          }
          <span className="text-sm" style={{ color: remindersOn ? "var(--text-primary)" : "var(--text-muted)" }}>
            Renewal reminders
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: remindersOn ? "rgba(52,199,89,0.15)" : "rgba(255,59,48,0.12)",
              color:      remindersOn ? "#34c759"               : "#ff3b30",
            }}
          >
            {remindersOn ? "ON" : "OFF"}
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 disabled:opacity-50"
          style={{ background: remindersOn ? "#34c759" : "var(--surface-container)" }}
          aria-label={remindersOn ? "Turn off reminders" : "Turn on reminders"}
        >
          <span
            className="h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: remindersOn ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      {/* Notification log */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Notification History
        </p>
        {logs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No notifications sent yet.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: ContractNotificationLog }) {
  const label = log.days_before === 0 ? "Manual" : `${log.days_before}d before`;

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <Mail className="h-3 w-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span
          className="rounded-full px-2 py-0.5 font-medium capitalize"
          style={{
            background: log.status === "sent"   ? "rgba(52,199,89,0.12)"
                      : log.status === "failed" ? "rgba(255,59,48,0.12)"
                      : "rgba(255,255,255,0.06)",
            color:      log.status === "sent"   ? "#34c759"
                      : log.status === "failed" ? "#ff3b30"
                      : "var(--text-muted)",
          }}
        >
          {log.status}
        </span>
      </div>
      <span style={{ color: "var(--text-muted)" }}>{formatDate(log.sent_at)}</span>
    </div>
  );
}
