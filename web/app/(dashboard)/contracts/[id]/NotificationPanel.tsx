"use client";

import { useState } from "react";
import { MessageSquare, Mail, Loader2, BellOff } from "lucide-react";
import type { ContractNotificationLog } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function NotificationPanel({
  contractId,
  initialSuppressed,
  hasTenantPhone,
  initialLogs,
}: {
  contractId: string;
  initialSuppressed: boolean;
  hasTenantPhone: boolean;
  initialLogs: ContractNotificationLog[];
}) {
  const [suppressed, setSuppressed]   = useState(initialSuppressed);
  const [togglingSuppress, setTogglingSuppress] = useState(false);
  const [sendingQuickSms, setSendingQuickSms]   = useState(false);
  const [quickSmsMsg, setQuickSmsMsg]           = useState<string | null>(null);
  const [logs, setLogs]               = useState<ContractNotificationLog[]>(initialLogs);

  async function handleSuppressToggle() {
    setTogglingSuppress(true);
    const next = !suppressed;
    setSuppressed(next);
    try {
      await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppress_notifications: next }),
      });
    } catch {
      setSuppressed(!next); // revert on error
    } finally {
      setTogglingSuppress(false);
    }
  }

  async function handleQuickSms() {
    setSendingQuickSms(true);
    setQuickSmsMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/quick-sms`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setQuickSmsMsg(`SMS sent to ${data.phone}`);
      // Refresh logs
      const logsRes = await fetch(`/api/contracts/${contractId}/notification-logs`);
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (e) {
      setQuickSmsMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setSendingQuickSms(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Suppress toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BellOff className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Suppress renewal notifications
          </span>
        </div>
        <button
          onClick={handleSuppressToggle}
          disabled={togglingSuppress}
          className="flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
          style={{
            background: suppressed ? "var(--accent)" : "var(--surface-container)",
          }}
          aria-label={suppressed ? "Resume notifications" : "Suppress notifications"}
        >
          <span
            className="h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: suppressed ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      {/* Quick SMS */}
      {hasTenantPhone && (
        <div className="space-y-1.5">
          <button
            onClick={handleQuickSms}
            disabled={sendingQuickSms}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "rgba(0,122,255,0.12)", color: "var(--accent)" }}
          >
            {sendingQuickSms
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <MessageSquare className="h-3.5 w-3.5" />
            }
            Send SMS to Tenant
          </button>
          {quickSmsMsg && (
            <p
              className="text-xs pl-1"
              style={{ color: quickSmsMsg.startsWith("Failed") ? "#ff3b30" : "#34c759" }}
            >
              {quickSmsMsg}
            </p>
          )}
        </div>
      )}

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
  const isEmail = log.channel === "email";
  const label   = log.days_before === 0
    ? "Manual"
    : `${log.days_before}d before`;

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        {isEmail
          ? <Mail className="h-3 w-3 shrink-0" style={{ color: "var(--text-muted)" }} />
          : <MessageSquare className="h-3 w-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        }
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span
          className="rounded-full px-2 py-0.5 font-medium capitalize"
          style={{
            background: log.status === "sent"
              ? "rgba(52,199,89,0.12)"
              : log.status === "failed"
              ? "rgba(255,59,48,0.12)"
              : "rgba(255,255,255,0.06)",
            color: log.status === "sent"
              ? "#34c759"
              : log.status === "failed"
              ? "#ff3b30"
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
