"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, ChevronDown, Loader2, Plus, X } from "lucide-react";
import type { NotificationTrigger } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Compact, collapsible card for lease-expiry reminder rules.
 * Full management also lives at /settings/notifications.
 */
export default function ExpiryReminderBar() {
  const t = useTranslations("contracts.reminders");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [days, setDays] = useState<number | "">("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notification-triggers")
      .then(async (res) => {
        if (res.ok && !cancelled) setTriggers(await res.json());
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    if (!days || Number(days) < 1) return;
    setAdding(true);
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
      toast.success(t("added"));
    } catch (e) {
      toast.error(t("addFailed"), { description: (e as Error).message });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = triggers;
    setTriggers((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/notification-triggers/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setTriggers(prev);
      toast.error(tc("error"));
    } else {
      toast.success(t("removed"));
    }
  }

  async function handleToggle(trigger: NotificationTrigger) {
    const next = { is_active: !trigger.is_active };
    setTriggers((prev) => prev.map((x) => (x.id === trigger.id ? { ...x, ...next } : x)));
    const res = await fetch(`/api/notification-triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    if (!res?.ok) {
      setTriggers((prev) => prev.map((x) => (x.id === trigger.id ? trigger : x)));
      toast.error(tc("saveFailed"));
    }
  }

  const activeCount = triggers.filter((x) => x.is_active).length;

  return (
    <section className="rounded-xl border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="expiry-reminders-panel"
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-surface-hover md:px-5"
      >
        <Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{t("title")}</span>
          <span className="block text-xs text-muted-foreground">
            {loading ? tc("loading") : t("summary", { count: activeCount })}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div id="expiry-reminders-panel" className="space-y-3 border-t px-4 py-4 md:px-5">
          <p className="text-sm text-muted-foreground">{t("description")}</p>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {tc("loading")}
            </p>
          ) : triggers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {triggers.map((x) => (
                <li
                  key={x.id}
                  className={cn(
                    "flex items-center gap-1 rounded-full border pl-1 text-sm",
                    x.is_active ? "border-border-strong bg-primary-soft text-primary-soft-foreground" : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(x)}
                    aria-pressed={x.is_active}
                    title={x.is_active ? t("pause") : t("activate")}
                    className="flex min-h-8 items-center gap-1.5 rounded-full px-2"
                  >
                    {t("daysBefore", { count: x.days_before })}
                    {x.label && <span className="opacity-70">· {x.label}</span>}
                    <span className="rounded bg-surface px-1 text-xs font-semibold uppercase">
                      {x.is_active ? t("on") : t("off")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(x.id)}
                    aria-label={t("remove", { count: x.days_before })}
                    className="flex size-8 items-center justify-center rounded-full opacity-70 hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {activeCount === 0 && <li className="self-center text-xs text-muted-foreground">{t("allPaused")}</li>}
            </ul>
          )}

          {showForm ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="reminder-days">{t("daysLabel")}</Label>
                <Input
                  id="reminder-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="30"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-28 tabular"
                />
              </div>
              <Button onClick={handleAdd} disabled={adding || !days}>
                {adding && <Loader2 className="animate-spin" />}
                {tc("save")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setDays("");
                }}
              >
                {tc("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus />
                {t("add")}
              </Button>
              <Button asChild variant="link" size="sm">
                <Link href="/settings/notifications">{t("manage")}</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
