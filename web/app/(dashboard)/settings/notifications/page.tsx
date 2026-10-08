"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, Check, Loader2, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import type { NotificationTrigger } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { LifecycleEmailsCard } from "@/components/settings/LifecycleEmailsCard";

export default function NotificationsSettingsPage() {
  const t = useTranslations("settings.notificationsPage");
  const tc = useTranslations("common");
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [daysBefore, setDaysBefore] = useState<number | "">(30);
  const [label, setLabel] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState<number | "">("");
  const [editLabel, setEditLabel] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<NotificationTrigger | null>(null);

  useEffect(() => {
    fetch("/api/notification-triggers")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        setTriggers(await res.json());
      })
      .catch((e: Error) => toast.error(t("loadError"), { description: e.message }))
      .finally(() => setLoading(false));
  }, [t]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!daysBefore || daysBefore < 1) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notification-triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days_before: Number(daysBefore),
          send_sms: false,
          send_email: true,
          label: label.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : res.statusText);
      setTriggers((prev) => [...prev, data].sort((a, b) => a.days_before - b.days_before));
      setDaysBefore(30);
      setLabel("");
      toast.success(t("added"));
    } catch (e) {
      toast.error(tc("saveFailed"), { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(trigger: NotificationTrigger) {
    const updated = { is_active: !trigger.is_active };
    setTriggers((prev) => prev.map((x) => (x.id === trigger.id ? { ...x, ...updated } : x)));
    const res = await fetch(`/api/notification-triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => null);
    if (!res?.ok) {
      setTriggers((prev) => prev.map((x) => (x.id === trigger.id ? { ...x, is_active: trigger.is_active } : x)));
      toast.error(tc("saveFailed"));
    }
  }

  function startEdit(trigger: NotificationTrigger) {
    setEditingId(trigger.id);
    setEditDays(trigger.days_before);
    setEditLabel(trigger.label ?? "");
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editDays || editDays < 1 || editDays > 365) {
      setEditError(t("daysRange"));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/notification-triggers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days_before: Number(editDays), label: editLabel.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : res.statusText);
      setTriggers((prev) => prev.map((x) => (x.id === id ? data : x)).sort((a, b) => a.days_before - b.days_before));
      setEditingId(null);
      toast.success(tc("saved"));
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/notification-triggers/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast.error(t("deleteError"));
      return;
    }
    setTriggers((prev) => prev.filter((x) => x.id !== id));
    toast.success(tc("deleted"));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader title={t("title")} description={t("description")} />

      <Card className="gap-4 py-4 md:py-5">
        <CardHeader className="px-4 md:px-5">
          <CardTitle className="text-base">
            <h3>{t("addTitle")}</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-5">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="days-before">{t("daysLabel")}</Label>
                <Input
                  id="days-before"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={daysBefore}
                  onChange={(e) => setDaysBefore(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="30"
                  className="h-10 sm:h-9 tabular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-label">{t("labelLabel")}</Label>
                <Input
                  id="trigger-label"
                  type="text"
                  maxLength={100}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("labelPlaceholder")}
                  className="h-10 sm:h-9"
                />
              </div>
            </div>
            <Button type="submit" disabled={saving || !daysBefore} className="h-10 sm:h-9">
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {t("addButton")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="triggers-title" className="space-y-3">
        <h3 id="triggers-title" className="text-base font-semibold text-foreground">{t("listTitle")}</h3>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : triggers.length === 0 ? (
          <EmptyState icon={Bell} title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <ul className="space-y-3">
            {triggers.map((trigger) => {
              const editing = editingId === trigger.id;
              return (
                <li key={trigger.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={trigger.is_active}
                      onCheckedChange={() => handleToggleActive(trigger)}
                      aria-label={t("activeToggle", { days: trigger.days_before })}
                      className="mt-1"
                    />

                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor={`edit-days-${trigger.id}`} className="sr-only">{t("daysLabel")}</Label>
                            <Input
                              id={`edit-days-${trigger.id}`}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={365}
                              value={editDays}
                              onChange={(e) => setEditDays(e.target.value === "" ? "" : Number(e.target.value))}
                              className="h-10 w-24 sm:h-9 tabular"
                            />
                            <span className="text-sm text-muted-foreground">{t("daysBeforeSuffix")}</span>
                            <Label htmlFor={`edit-label-${trigger.id}`} className="sr-only">{t("labelLabel")}</Label>
                            <Input
                              id={`edit-label-${trigger.id}`}
                              type="text"
                              maxLength={100}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder={t("labelLabel")}
                              className="h-10 w-full sm:h-9 sm:w-48"
                            />
                          </div>
                          {editError && <p className="text-xs text-danger">{editError}</p>}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-foreground">
                            {t("daysBefore", { count: trigger.days_before })}
                            {trigger.label && (
                              <span className="ml-2 text-sm font-normal text-muted-foreground">{trigger.label}</span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="size-3.5" aria-hidden />
                            {t("channelEmail")}
                            <span aria-hidden>·</span>
                            {trigger.is_active ? t("on") : t("off")}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {editing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 sm:size-9"
                            onClick={() => handleSaveEdit(trigger.id)}
                            disabled={editSaving}
                            aria-label={tc("save")}
                          >
                            {editSaving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 sm:size-9"
                            onClick={() => setEditingId(null)}
                            aria-label={tc("cancel")}
                          >
                            <X aria-hidden />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 sm:size-9"
                          onClick={() => startEdit(trigger)}
                          aria-label={tc("edit")}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 text-danger hover:bg-danger-soft hover:text-danger sm:size-9"
                        onClick={() => setDeleteTarget(trigger)}
                        aria-label={tc("delete")}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LifecycleEmailsCard />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteBody", { count: deleteTarget.days_before }) : undefined}
        confirmLabel={tc("delete")}
        onConfirm={() => (deleteTarget ? handleDelete(deleteTarget.id) : undefined)}
      />
    </div>
  );
}
