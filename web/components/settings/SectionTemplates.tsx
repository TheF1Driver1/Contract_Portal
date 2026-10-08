"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { UserSectionTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { ClauseTranslate } from "@/components/ai/ClauseTranslate";

/** Clause library (settings). `aiTranslate` shows the AI translation draft (Plan 39). */
export function SectionTemplates({ aiTranslate = false }: { aiTranslate?: boolean }) {
  const t = useTranslations("settings.sectionsPage");
  const tc = useTranslations("common");
  const [templates, setTemplates] = useState<UserSectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserSectionTemplate | null>(null);

  useEffect(() => {
    fetch("/api/user-sections")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/user-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => [data, ...prev]);
        setNewTitle("");
        setNewBody("");
        toast.success(t("added"));
      } else {
        setAddError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/user-sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => prev.map((x) => (x.id === id ? data : x)));
        setEditId(null);
        toast.success(tc("saved"));
      } else {
        toast.error(tc("saveFailed"));
      }
    } catch {
      toast.error(tc("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/user-sections/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setTemplates((prev) => prev.filter((x) => x.id !== id));
      toast.success(tc("deleted"));
    } else {
      toast.error(t("deleteError"));
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader title={t("title")} description={t("description")} />

      <Card className="gap-4 py-4 md:py-5">
        <CardHeader className="px-4 md:px-5">
          <CardTitle className="text-base">
            <h3>{t("newTitle")}</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-5">
          <form onSubmit={add} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section-title">{t("titleLabel")}</Label>
              <Input
                id="section-title"
                placeholder={t("titlePlaceholder")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section-body">{t("bodyLabel")}</Label>
              <Textarea
                id="section-body"
                rows={4}
                placeholder={t("bodyPlaceholder")}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
            </div>
            {addError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{addError}</p>
            )}
            <Button type="submit" disabled={adding || !newTitle.trim()} className="h-10 sm:h-9">
              {adding ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {t("addButton")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="sections-list" className="space-y-3">
        <h3 id="sections-list" className="text-base font-semibold text-foreground">{t("listTitle")}</h3>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState icon={BookOpen} title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <ul className="space-y-3">
            {templates.map((x) => (
              <li key={x.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
                {editId === x.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-title-${x.id}`}>{t("titleLabel")}</Label>
                      <Input
                        id={`edit-title-${x.id}`}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-10 font-semibold sm:h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-body-${x.id}`}>{t("bodyLabel")}</Label>
                      <Textarea
                        id={`edit-body-${x.id}`}
                        rows={5}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveEdit(x.id)} disabled={saving} className="h-10 sm:h-9">
                        {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                        {tc("save")}
                      </Button>
                      <Button variant="outline" onClick={() => setEditId(null)} className="h-10 sm:h-9">
                        <X aria-hidden />
                        {tc("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="pt-2 text-sm font-semibold text-foreground">{x.title}</h4>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 sm:size-9"
                          onClick={() => { setEditId(x.id); setEditTitle(x.title); setEditBody(x.body); }}
                          aria-label={t("editAria", { title: x.title })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-danger hover:bg-danger-soft hover:text-danger sm:size-9"
                          onClick={() => setDeleteTarget(x)}
                          aria-label={t("deleteAria", { title: x.title })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {x.body && <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{x.body}</p>}
                    {aiTranslate && (
                      <div className="mt-2">
                        <ClauseTranslate
                          title={x.title}
                          body={x.body}
                          onAccept={(next) => {
                            // Opens the edit form with the translation; saving stays manual.
                            setEditId(x.id);
                            setEditTitle(next.title);
                            setEditBody(next.body);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteBody", { title: deleteTarget.title }) : undefined}
        confirmLabel={tc("delete")}
        onConfirm={() => (deleteTarget ? remove(deleteTarget.id) : undefined)}
      />
    </div>
  );
}
