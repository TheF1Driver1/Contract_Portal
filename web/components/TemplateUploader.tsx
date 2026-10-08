"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, FileText, Loader2, Star, Trash2, Upload } from "lucide-react";
import type { ContractTemplate } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { cn } from "@/lib/utils";

interface Props {
  templates: ContractTemplate[];
  loading?: boolean;
  onUploaded: (t: ContractTemplate) => void;
  onDeleted: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const CONTRACT_TYPES = ["all", "lease", "rental", "addendum"] as const;

export default function TemplateUploader({ templates, loading, onUploaded, onDeleted, onSetDefault }: Props) {
  const t = useTranslations("settings.templatesPage");
  const tc = useTranslations("common");
  const f = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contract_type: "all", is_default: false });
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);

  const typeLabel = (type: string) =>
    (CONTRACT_TYPES as readonly string[]).includes(type) ? t(`types.${type}`) : type;

  async function upload(file: File) {
    if (!file.name.endsWith(".docx")) {
      setError(t("onlyDocx"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("tooLarge"));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("meta", JSON.stringify({
        name: form.name || file.name.replace(/\.docx$/i, ""),
        contract_type: form.contract_type,
        is_default: form.is_default,
      }));

      const res = await fetch("/api/templates", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : t("uploadFailed"));
      }
      const created: ContractTemplate = await res.json();
      onUploaded(created);
      setForm({ name: "", contract_type: "all", is_default: false });
      toast.success(t("uploaded"));
    } catch (e) {
      setError((e as Error).message);
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      onDeleted(id);
      toast.success(tc("deleted"));
    } else {
      toast.error(t("deleteError"));
    }
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    }).catch(() => null);
    if (res?.ok) {
      onSetDefault(id);
      toast.success(t("defaultSet"));
    } else {
      toast.error(tc("saveFailed"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card className="gap-4 py-4 md:py-5">
        <CardHeader className="px-4 md:px-5">
          <CardTitle className="text-base">
            <h3>{t("uploadTitle")}</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">{t("nameLabel")}</Label>
              <Input
                id="template-name"
                type="text"
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-type">{t("typeLabel")}</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm((s) => ({ ...s, contract_type: v }))}>
                <SelectTrigger id="template-type" className="h-10 w-full sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>{t(`types.${v}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex min-h-10 items-center gap-3">
            <Checkbox
              id="template-default"
              checked={form.is_default}
              onCheckedChange={(c) => setForm((s) => ({ ...s, is_default: c === true }))}
            />
            <Label htmlFor="template-default" className="cursor-pointer font-normal">{t("setDefaultLabel")}</Label>
          </div>

          {/* Drop zone */}
          <button
            type="button"
            disabled={uploading}
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              dragging ? "border-primary bg-primary-soft" : "border-border-strong hover:bg-surface-hover"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) upload(file);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Upload className="size-8 text-muted-foreground" aria-hidden />
            )}
            <span>
              <span className="block text-sm font-medium text-foreground">
                {uploading ? t("uploading") : t("dropTitle")}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{t("dropHint")}</span>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            aria-label={t("dropTitle")}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }}
          />

          {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {/* List */}
      <section aria-labelledby="templates-list" className="space-y-3">
        <h3 id="templates-list" className="text-base font-semibold text-foreground">{t("listTitle")}</h3>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 md:p-4">
                <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span className="truncate">{tpl.name}</span>
                    {tpl.is_default && (
                      <Badge className="bg-primary-soft text-primary-soft-foreground">
                        <Star aria-hidden />
                        {t("default")}
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {typeLabel(tpl.contract_type)} · {f.dateTime(new Date(tpl.created_at), { dateStyle: "medium" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!tpl.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 sm:size-9"
                      onClick={() => setDefault(tpl.id)}
                      aria-label={t("setDefaultAria", { name: tpl.name })}
                    >
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="icon" className="size-10 sm:size-9">
                    <a href={tpl.file_url} download aria-label={t("downloadAria", { name: tpl.name })}>
                      <Download aria-hidden />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 text-danger hover:bg-danger-soft hover:text-danger sm:size-9"
                    onClick={() => setDeleteTarget(tpl)}
                    aria-label={t("deleteAria", { name: tpl.name })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteBody", { name: deleteTarget.name }) : undefined}
        confirmLabel={tc("delete")}
        onConfirm={() => (deleteTarget ? deleteTemplate(deleteTarget.id) : undefined)}
      />
    </div>
  );
}
