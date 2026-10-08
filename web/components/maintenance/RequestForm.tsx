"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker, uploadPhoto } from "@/components/maintenance/PhotoPicker";
import { createMaintenanceRequest, createTenantMaintenanceRequest } from "@/lib/actions/maintenance";
import { CATEGORIES, MAX_PHOTOS_PER_RECORD, URGENCIES } from "@/lib/maintenance/logic";
import type { MaintenanceCategory, MaintenanceUrgency } from "@/lib/db";

/** New maintenance request: landlords pick a lease; tenants file for their own. */
export function RequestForm({
  open,
  onOpenChange,
  mode,
  leases = [],
  contractId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "landlord" | "tenant";
  leases?: { id: string; label: string }[];
  contractId?: string;
}) {
  const t = useTranslations("maintenance.form");
  const tc = useTranslations("maintenance.category");
  const tu = useTranslations("maintenance.urgency");
  const th = useTranslations("maintenance.urgencyHint");
  const router = useRouter();
  const [lease, setLease] = useState(contractId ?? (leases.length === 1 ? leases[0].id : ""));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("plumbing");
  const [urgency, setUrgency] = useState<MaintenanceUrgency>("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const formId = `maint-form-${contractId ?? "new"}`;

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("plumbing");
    setUrgency("normal");
    setFiles([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lease) return void toast.error(t("leasePlaceholder"));
    setBusy(true);
    const payload = { contract_id: lease, title, description, category, urgency };
    const res = await (mode === "tenant" ? createTenantMaintenanceRequest : createMaintenanceRequest)(payload);
    if (!res.ok || !res.id) {
      setBusy(false);
      return void toast.error(res.ok ? t("failed") : res.error);
    }
    for (const file of files) {
      const up = await uploadPhoto("maintenance", res.id, file);
      if (!up.ok) toast.error(t("photoFailed", { name: file.name, error: up.error }));
    }
    setBusy(false);
    if (res.warning) toast.warning(res.warning);
    else toast.success(mode === "tenant" ? t("sent") : t("created"));
    reset();
    onOpenChange(false);
    if (mode === "landlord") router.push(`/maintenance/${res.id}`);
    else router.refresh();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={mode === "tenant" ? t("tenantTitle") : t("title")}
      description={mode === "tenant" ? t("tenantDescription") : t("description")}
      footer={
        <Button type="submit" form={formId} disabled={busy || !title.trim() || !lease}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy && files.length ? t("uploading") : mode === "tenant" ? t("submit") : t("create")}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {mode === "landlord" &&
          (leases.length === 0 ? (
            <p className="rounded-lg bg-surface-muted p-3 text-sm text-muted-foreground">{t("noLeases")}</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-lease`}>{t("lease")}</Label>
              <Select value={lease} onValueChange={setLease}>
                <SelectTrigger id={`${formId}-lease`} className="w-full">
                  <SelectValue placeholder={t("leasePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {leases.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-title`}>{t("summary")}</Label>
          <Input id={`${formId}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder={t("summaryPlaceholder")} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-category`}>{t("category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MaintenanceCategory)}>
              <SelectTrigger id={`${formId}-category`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {tc(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-urgency`}>{t("urgency")}</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as MaintenanceUrgency)}>
              <SelectTrigger id={`${formId}-urgency`} className="w-full" aria-describedby={`${formId}-urgency-hint`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCIES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {tu(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id={`${formId}-urgency-hint`} className="text-xs text-muted-foreground">
              {th(urgency)}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-details`}>{t("details")}</Label>
          <Textarea id={`${formId}-details`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder={t("detailsPlaceholder")} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("photos")}</legend>
          <PhotoPicker
            disabled={files.length >= MAX_PHOTOS_PER_RECORD}
            onFiles={(f) => setFiles((prev) => [...prev, ...f].slice(0, MAX_PHOTOS_PER_RECORD))}
          />
          <p className="text-xs text-muted-foreground">{t("photosHint", { max: MAX_PHOTOS_PER_RECORD })}</p>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-2 py-1 text-sm">
                  <span className="truncate">{f.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("removePhoto", { name: f.name })}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </form>
    </FormSheet>
  );
}
