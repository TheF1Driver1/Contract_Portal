"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, Check, FileText, Loader2, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { ContractAttachment, ContractCustomSection, UserSectionTemplate } from "@/lib/types";
import { ConfirmDialog } from "@/components/contracts/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  contractId: string;
}

/** Attachments (PDF uploads) and custom clauses for one contract. */
export default function ContractDocumentsPanel({ contractId }: Props) {
  const t = useTranslations("contracts.documents");
  return (
    <Tabs defaultValue="attachments">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="attachments">
          <Paperclip />
          {t("attachments")}
        </TabsTrigger>
        <TabsTrigger value="sections">
          <FileText />
          {t("sections")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="attachments" className="pt-2">
        <AttachmentsTab contractId={contractId} />
      </TabsContent>
      <TabsContent value="sections" className="pt-2">
        <SectionsTab contractId={contractId} />
      </TabsContent>
    </Tabs>
  );
}

// ── Attachments ───────────────────────────────────────────────────────────────

function AttachmentsTab({ contractId }: { contractId: string }) {
  const t = useTranslations("contracts.documents");
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/attachments`)
      .then(async (r) => {
        if (r.ok) setAttachments(await r.json());
      })
      .catch(() => {});
  }, [contractId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError(t("onlyPdf"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("maxSize"));
      return;
    }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/attachments`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("uploadFailed"));
        toast.error(t("uploadFailed"));
        return;
      }
      setAttachments((prev) => [...prev, data]);
      toast.success(t("uploaded"));
    } catch (e) {
      setError((e as Error).message);
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contracts/${contractId}/attachments/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("attachmentRemoved"));
      setConfirmId(null);
    } else {
      toast.error(t("removeFailed"));
    }
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">{t("noAttachments")}</p>}

      {attachments.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {att.signed_url ? (
                  <a
                    href={att.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {att.name}
                  </a>
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{att.name}</span>
                )}
                {att.file_size ? (
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {t("kb", { size: Math.round(att.file_size / 1024) })}
                  </span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmId(att.id)}
                aria-label={t("removeAttachmentNamed", { name: att.name })}
                className="text-danger hover:text-danger"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleUpload}
        aria-label={t("uploadPdf")}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="h-11 w-full border-dashed"
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        {uploading ? t("uploading") : t("uploadPdf")}
      </Button>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title={t("removeAttachmentTitle")}
        confirmLabel={t("remove")}
        onConfirm={() => (confirmId ? handleDelete(confirmId) : undefined)}
      />
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function SectionsTab({ contractId }: { contractId: string }) {
  const t = useTranslations("contracts.documents");
  const tc = useTranslations("common");
  const [sections, setSections] = useState<ContractCustomSection[]>([]);
  const [templates, setTemplates] = useState<UserSectionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/sections`)
      .then(async (r) => {
        if (r.ok) setSections(await r.json());
      })
      .catch(() => {});
    fetch("/api/user-sections")
      .then(async (r) => {
        if (r.ok) setTemplates(await r.json());
      })
      .catch(() => {});
  }, [contractId]);

  async function addSection(title: string, body: string) {
    if (!title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections((prev) => [...prev, data]);
        setNewTitle("");
        setNewBody("");
        toast.success(t("sectionAdded"));
      } else {
        toast.error(tc("saveFailed"));
      }
    } catch {
      toast.error(tc("saveFailed"));
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections((prev) => prev.map((s) => (s.id === id ? data : s)));
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

  async function deleteSection(id: string) {
    const res = await fetch(`/api/contracts/${contractId}/sections/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setSections((prev) => prev.filter((s) => s.id !== id));
      toast.success(tc("deleted"));
      setConfirmId(null);
    } else {
      toast.error(t("removeFailed"));
    }
  }

  function startEdit(sec: ContractCustomSection) {
    setEditId(sec.id);
    setEditTitle(sec.title);
    setEditBody(sec.body);
  }

  return (
    <div className="space-y-3">
      {sections.length === 0 && !showTemplates && (
        <p className="py-3 text-center text-sm text-muted-foreground">{t("noSections")}</p>
      )}

      {sections.map((sec) => (
        <div key={sec.id} className="space-y-2 rounded-lg border p-3">
          {editId === sec.id ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`sec-title-${sec.id}`}>{t("sectionTitle")}</Label>
                <Input id={`sec-title-${sec.id}`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sec-body-${sec.id}`}>{t("sectionBody")}</Label>
                <Textarea id={`sec-body-${sec.id}`} rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(sec.id)} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                  {tc("save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  {tc("cancel")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(sec)} aria-label={t("editSectionNamed", { name: sec.title })}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirmId(sec.id)}
                    aria-label={t("deleteSectionNamed", { name: sec.title })}
                    className="text-danger hover:text-danger"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {sec.body || <span className="italic text-subtle-foreground">{t("emptySection")}</span>}
              </p>
            </>
          )}
        </div>
      ))}

      {showTemplates && templates.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-surface-muted p-3">
          <h4 className="text-sm font-semibold">{t("fromTemplateTitle")}</h4>
          <ul className="space-y-1">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    await addSection(tpl.title, tpl.body);
                    setShowTemplates(false);
                  }}
                >
                  {tpl.title}
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>
            {tc("cancel")}
          </Button>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <h4 className="text-sm font-semibold">{t("newSection")}</h4>
        <div className="space-y-1.5">
          <Label htmlFor="new-sec-title">{t("sectionTitle")}</Label>
          <Input id="new-sec-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-sec-body">{t("sectionBody")}</Label>
          <Textarea id="new-sec-body" rows={3} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => addSection(newTitle, newBody)} disabled={adding || !newTitle.trim()}>
            {adding ? <Loader2 className="animate-spin" /> : <Plus />}
            {t("addSection")}
          </Button>
          {templates.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowTemplates((v) => !v)}>
              <BookOpen />
              {t("fromTemplate")}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("sectionsHint")}{" "}
        <Link href="/settings/sections" className="font-medium text-primary underline-offset-2 hover:underline">
          {t("manageTemplates")}
        </Link>
      </p>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title={t("deleteSectionTitle")}
        confirmLabel={tc("delete")}
        onConfirm={() => (confirmId ? deleteSection(confirmId) : undefined)}
      />
    </div>
  );
}
