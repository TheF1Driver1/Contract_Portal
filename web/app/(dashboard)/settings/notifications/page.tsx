"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, Loader2, Mail } from "lucide-react";
import type { NotificationTrigger } from "@/lib/types";

export default function NotificationsSettingsPage() {
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [daysBefore, setDaysBefore] = useState<number | "">(30);
  const [label, setLabel]           = useState("");

  useEffect(() => { fetchTriggers(); }, []);

  async function fetchTriggers() {
    setLoading(true);
    try {
      const res = await fetch("/api/notification-triggers");
      if (!res.ok) throw new Error(await res.text());
      setTriggers(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!daysBefore || daysBefore < 1) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notification-triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days_before: Number(daysBefore),
          send_sms:    false,
          send_email:  true,
          label:       label.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setTriggers((prev) => [...prev, data].sort((a, b) => a.days_before - b.days_before));
      setDaysBefore(30);
      setLabel("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(trigger: NotificationTrigger) {
    const updated = { is_active: !trigger.is_active };
    setTriggers((prev) =>
      prev.map((t) => (t.id === trigger.id ? { ...t, ...updated } : t))
    );
    await fetch(`/api/notification-triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  async function handleDelete(id: string) {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/notification-triggers/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-2xl font-bold tracking-tight">Expiry Notifications</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Get emailed before a lease expires. Add as many triggers as you need.
        </p>
      </div>

      {/* Add trigger form */}
      <div className="surface-card space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Add Trigger
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Days Before Expiry
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={daysBefore}
              onChange={(e) => setDaysBefore(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-28 rounded-lg border px-3 py-2 text-sm"
              style={{
                background:   "var(--surface-container)",
                borderColor:  "var(--surface-border)",
                color:        "var(--text-primary)",
              }}
              placeholder="30"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Label (optional)
            </label>
            <input
              type="text"
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-44 rounded-lg border px-3 py-2 text-sm"
              style={{
                background:  "var(--surface-container)",
                borderColor: "var(--surface-border)",
                color:       "var(--text-primary)",
              }}
              placeholder="e.g. 30-day warning"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "#ff3b30" }}>{error}</p>
        )}

        <button
          onClick={handleAdd}
          disabled={saving || !daysBefore}
          className="btn-primary flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Trigger
        </button>
      </div>

      {/* Trigger list */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Active Triggers
        </p>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        )}

        {!loading && triggers.length === 0 && (
          <div
            className="rounded-xl border py-8 text-center text-sm"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}
          >
            No triggers configured. Add one above to start receiving notifications.
          </div>
        )}

        {triggers.map((trigger) => (
          <div key={trigger.id} className="surface-card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Active toggle */}
              <button
                onClick={() => handleToggleActive(trigger)}
                className="flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
                style={{ background: trigger.is_active ? "var(--accent)" : "var(--surface-container)" }}
                aria-label={trigger.is_active ? "Deactivate" : "Activate"}
              >
                <span
                  className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: trigger.is_active ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>

              <div>
                <p className="text-sm font-semibold">
                  {trigger.days_before} {trigger.days_before === 1 ? "day" : "days"} before expiry
                  {trigger.label && (
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                      {trigger.label}
                    </span>
                  )}
                </p>
                <span className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <Mail className="h-3 w-3" /> Email
                </span>
              </div>
            </div>

            <button
              onClick={() => handleDelete(trigger.id)}
              className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-red-500/10"
              style={{ color: "#ff3b30" }}
              aria-label="Delete trigger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
