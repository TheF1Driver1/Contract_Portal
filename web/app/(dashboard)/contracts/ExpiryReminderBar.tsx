"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, X, Loader2 } from "lucide-react";
import type { NotificationTrigger } from "@/lib/types";

export default function ExpiryReminderBar() {
  const [triggers, setTriggers]     = useState<NotificationTrigger[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [days, setDays]             = useState<number | "">("");
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notification-triggers");
      if (res.ok) setTriggers(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!days || Number(days) < 1) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/notification-triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days_before: Number(days), send_email: true, send_sms: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setTriggers((prev) => [...prev, data].sort((a, b) => a.days_before - b.days_before));
      setDays("");
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/notification-triggers/${id}`, { method: "DELETE" });
  }

  async function handleToggle(trigger: NotificationTrigger) {
    const next = { is_active: !trigger.is_active };
    setTriggers((prev) => prev.map((t) => (t.id === trigger.id ? { ...t, ...next } : t)));
    await fetch(`/api/notification-triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  const active = triggers.filter((t) => t.is_active);

  return (
    <div
      className="surface-card animate-slide-up"
      style={{ animationDelay: "0.06s", animationFillMode: "both" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">Expiry Reminders</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            — get emailed before a lease expires
          </span>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(null); }}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          style={{ background: "rgba(0,122,255,0.12)", color: "var(--accent)" }}
        >
          <Plus className="h-3 w-3" />
          Add reminder
        </button>
      </div>

      {/* Trigger pills */}
      {loading ? (
        <div className="mt-3 flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>
        </div>
      ) : triggers.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          No reminders set. Add one to get notified before leases expire.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {triggers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: t.is_active ? "rgba(0,122,255,0.12)" : "var(--surface-container)",
                color:      t.is_active ? "var(--accent)"         : "var(--text-muted)",
                border:     `1px solid ${t.is_active ? "rgba(0,122,255,0.25)" : "var(--surface-border)"}`,
              }}
            >
              <button
                onClick={() => handleToggle(t)}
                title={t.is_active ? "Click to pause" : "Click to activate"}
                className="flex items-center gap-1.5 leading-none"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: t.is_active ? "#34c759" : "var(--text-muted)" }}
                />
                {t.days_before} {t.days_before === 1 ? "day" : "days"} before
                {t.label && <span className="opacity-60 ml-0.5">· {t.label}</span>}
                <span
                  className="ml-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: t.is_active ? "rgba(52,199,89,0.15)"    : "rgba(255,255,255,0.06)",
                    color:      t.is_active ? "#34c759"                  : "var(--text-muted)",
                  }}
                >
                  {t.is_active ? "on" : "off"}
                </span>
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="ml-0.5 opacity-50 hover:opacity-100"
                aria-label="Remove reminder"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {active.length === 0 && triggers.length > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              All reminders paused
            </span>
          )}
        </div>
      )}

      {/* Inline add form */}
      {showForm && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{ borderColor: "var(--surface-border)", background: "var(--surface-container)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Notify me</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-14 bg-transparent text-sm font-semibold text-center outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>days before expiry</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !days}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save
          </button>
          <button
            onClick={() => { setShowForm(false); setError(null); setDays(""); }}
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          {error && <p className="text-xs w-full" style={{ color: "#ff3b30" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
