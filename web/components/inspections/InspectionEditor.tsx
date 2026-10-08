"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoGrid, PhotoPicker, uploadPhoto } from "@/components/maintenance/PhotoPicker";
import { completeInspection, deleteDraftInspection, updateInspectionDetails, updateInspectionItem } from "@/lib/actions/inspections";
import { CONDITIONS, groupByRoom, inspectionLabeler, progress, worsened } from "@/lib/inspections/checklist";
import { MAX_PHOTOS_PER_RECORD } from "@/lib/maintenance/logic";
import type { InspectionCondition } from "@/lib/db";
import type { InspectionItemVM, InspectionVM } from "@/components/inspections/types";
import { cn } from "@/lib/utils";

const CONDITION_TONE: Record<InspectionCondition, string> = {
  good: "peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success",
  fair: "peer-checked:border-warning peer-checked:bg-warning-soft peer-checked:text-warning",
  poor: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger",
  damaged: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger",
  na: "peer-checked:border-border-strong peer-checked:bg-surface-muted peer-checked:text-foreground",
};

export function useInspectionLabels(items: { room: string }[]) {
  const t = useTranslations("inspections");
  return useMemo(
    () => inspectionLabeler(items.map((i) => i.room), (k, v) => t(k as "section", v as never), (k) => t.has(k as "section")),
    [items, t]
  );
}

/** Mobile-first checklist editor: one room at a time, condition chips, notes and photos. */
export function InspectionEditor({ inspection, items: initial, subtitle }: { inspection: InspectionVM; items: InspectionItemVM[]; subtitle: string }) {
  const t = useTranslations("inspections");
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [roomIndex, setRoomIndex] = useState(0);
  const [date, setDate] = useState(inspection.inspected_on);
  const [notes, setNotes] = useState(inspection.notes ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const labels = useInspectionLabels(initial);
  const readOnly = inspection.status === "completed";

  // Keep local edits but pick up new photo URLs after a refresh.
  const merged = items.map((i) => ({ ...i, photos: initial.find((x) => x.id === i.id)?.photos ?? i.photos }));
  const rooms = groupByRoom(merged);
  const room = rooms[Math.min(roomIndex, rooms.length - 1)];
  const p = progress(merged);
  const contractHref = `/contracts/${inspection.contract_id}`;

  if (readOnly) {
    return (
      <div className="space-y-6">
        <Header inspection={inspection} subtitle={subtitle} backHref={contractHref} />
        <InspectionReadOnly inspection={inspection} items={initial} />
      </div>
    );
  }

  async function setItem(id: string, patch: Partial<Pick<InspectionItemVM, "condition" | "note">>) {
    const prev = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const res = await updateInspectionItem({ id, ...patch });
    if (!res.ok) {
      setItems(prev);
      toast.error(res.error);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    const res = await updateInspectionDetails({ id: inspection.id, inspected_on: date, notes });
    setSavingDetails(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("editor.saved"));
  }

  return (
    <div className="space-y-6">
      <Header inspection={inspection} subtitle={subtitle} backHref={contractHref} />

      <form onSubmit={saveDetails} className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-[12rem_1fr_auto] md:items-end md:p-5">
        <div className="space-y-2">
          <Label htmlFor="insp-date">{t("editor.date")}</Label>
          <Input id="insp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insp-notes">{t("editor.notes")}</Label>
          <Textarea id="insp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={1} placeholder={t("editor.notesPlaceholder")} className="min-h-9" />
        </div>
        <Button type="submit" variant="outline" disabled={savingDetails}>
          {savingDetails && <Loader2 className="animate-spin" aria-hidden />}
          {t("editor.saveDetails")}
        </Button>
      </form>

      {room ? (
        <section aria-labelledby="room-title" className="rounded-xl border bg-surface p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="icon" disabled={roomIndex === 0} onClick={() => setRoomIndex((i) => i - 1)} aria-label={t("editor.prevRoom")}>
              <ChevronLeft aria-hidden />
            </Button>
            <div className="min-w-0 text-center">
              <h2 id="room-title" className="truncate text-base font-semibold text-foreground">
                {labels.room(room.room)}
              </h2>
              <p className="text-xs text-muted-foreground">{t("editor.roomOf", { n: Math.min(roomIndex, rooms.length - 1) + 1, total: rooms.length })}</p>
            </div>
            <Button type="button" variant="outline" size="icon" disabled={roomIndex >= rooms.length - 1} onClick={() => setRoomIndex((i) => i + 1)} aria-label={t("editor.nextRoom")}>
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <nav aria-label={t("editor.rooms")} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {rooms.map((r, i) => {
              const rp = progress(r.items);
              const current = i === Math.min(roomIndex, rooms.length - 1);
              return (
                <button
                  key={r.room}
                  type="button"
                  onClick={() => setRoomIndex(i)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium",
                    current ? "border-primary bg-primary-soft text-primary-soft-foreground" : "bg-surface text-muted-foreground hover:bg-surface-hover"
                  )}
                >
                  {rp.rated === rp.total && <CheckCircle2 className="size-3.5" aria-hidden />}
                  {labels.room(r.room)}
                  <span className="tabular">
                    {rp.rated}/{rp.total}
                  </span>
                </button>
              );
            })}
          </nav>

          <ul className="divide-y">
            {room.items.map((item) => (
              <ItemEditor key={item.id} inspectionId={inspection.id} item={item} label={labels.item(item.item)} onChange={(patch) => setItem(item.id, patch)} onPhotos={() => router.refresh()} />
            ))}
          </ul>

          {roomIndex < rooms.length - 1 && (
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setRoomIndex((i) => i + 1)}>
                {t("editor.nextRoom")}
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t("editor.empty")}</p>
      )}

      <div className="sticky bottom-20 z-10 rounded-xl border bg-surface px-4 py-3 shadow-sm md:bottom-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="tabular font-medium text-foreground">{t("progress", { rated: p.rated, total: p.total })}</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => setDiscardOpen(true)} aria-label={t("editor.discard")}>
              <Trash2 aria-hidden />
            </Button>
            <Button type="button" onClick={() => setCompleteOpen(true)} disabled={p.rated < p.total}>
              {t("editor.complete")}
            </Button>
          </div>
        </div>
      </div>

      <CompleteDialog open={completeOpen} onOpenChange={setCompleteOpen} inspectionId={inspection.id} onDone={() => router.refresh()} />
      <DiscardDialog open={discardOpen} onOpenChange={setDiscardOpen} inspectionId={inspection.id} onDone={() => router.push(contractHref)} />
    </div>
  );
}

function Header({ inspection, subtitle, backHref }: { inspection: InspectionVM; subtitle: string; backHref: string }) {
  const t = useTranslations("inspections");
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft aria-hidden />
          {t("editor.back")}
        </Link>
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t(`kind.${inspection.kind}`)}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/inspections/${inspection.id}/pdf`} target="_blank" rel="noopener">
            <FileDown aria-hidden />
            {t("downloadPdf")}
          </a>
        </Button>
      </div>
    </div>
  );
}

function ItemEditor({
  inspectionId,
  item,
  label,
  onChange,
  onPhotos,
}: {
  inspectionId: string;
  item: InspectionItemVM;
  label: string;
  onChange: (patch: Partial<Pick<InspectionItemVM, "condition" | "note">>) => void;
  onPhotos: () => void;
}) {
  const t = useTranslations("inspections");
  const [note, setNote] = useState(item.note ?? "");
  const [showNote, setShowNote] = useState(!!item.note);
  const [uploading, setUploading] = useState(false);
  const worse = worsened(item.baseline?.condition, item.condition);

  async function addPhotos(files: File[]) {
    setUploading(true);
    for (const file of files.slice(0, MAX_PHOTOS_PER_RECORD - item.photos.length)) {
      const res = await uploadPhoto("inspections", inspectionId, file, item.id);
      if (!res.ok) toast.error(res.error);
    }
    setUploading(false);
    onPhotos();
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground" id={`lbl-${item.id}`}>
          {label}
        </p>
        {item.baseline && (
          <p className={cn("text-xs", worse ? "font-medium text-danger" : "text-muted-foreground")}>
            {t("editor.moveIn", { condition: item.baseline.condition ? t(`condition.${item.baseline.condition}`) : "—" })}
            {worse ? ` · ${t("editor.worse")}` : ""}
          </p>
        )}
      </div>
      <div role="radiogroup" aria-labelledby={`lbl-${item.id}`} className="flex flex-wrap gap-1.5">
        {CONDITIONS.map((c) => (
          <label key={c} className="relative">
            <input
              type="radio"
              name={`cond-${item.id}`}
              value={c}
              checked={item.condition === c}
              onChange={() => onChange({ condition: c })}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-sm text-muted-foreground hover:bg-surface-hover peer-focus-visible:ring-2 peer-focus-visible:ring-ring sm:min-h-8",
                CONDITION_TONE[c]
              )}
            >
              {t(`condition.${c}`)}
            </span>
          </label>
        ))}
      </div>
      {showNote ? (
        <div className="space-y-1">
          <Label htmlFor={`note-${item.id}`} className="text-xs text-muted-foreground">
            {t("editor.itemNote", { item: label })}
          </Label>
          <Textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (item.note ?? "") && onChange({ note })}
            maxLength={1000}
            rows={2}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!showNote && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNote(true)}>
            {t("editor.addNote")}
          </Button>
        )}
        <PhotoPicker compact onFiles={addPhotos} busy={uploading} disabled={item.photos.length >= MAX_PHOTOS_PER_RECORD} labelSuffix={label} />
        {item.photos.length > 0 && <span className="text-xs text-muted-foreground">{t("photoCount", { count: item.photos.length })}</span>}
      </div>
      {item.photos.length > 0 && <PhotoGrid photos={item.photos} altPrefix={label} />}
    </li>
  );
}

function CompleteDialog({ open, onOpenChange, inspectionId, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; inspectionId: string; onDone: () => void }) {
  const t = useTranslations("inspections.editor");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const res = await completeInspection({ id: inspectionId, confirm });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    if (res.warning) toast.warning(res.warning);
    else toast.success(t("completed"));
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("completeTitle")}</DialogTitle>
          <DialogDescription>{t("completeBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox id="insp-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
          <Label htmlFor="insp-confirm" className="font-normal leading-snug">
            {t("completeConfirm")}
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={!confirm || busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t("completeAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscardDialog({ open, onOpenChange, inspectionId, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; inspectionId: string; onDone: () => void }) {
  const t = useTranslations("inspections.editor");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const res = await deleteDraftInspection(inspectionId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("discarded"));
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("discardTitle")}</DialogTitle>
          <DialogDescription>{t("discardBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t("discardAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Completed inspection, room by room. Used by the landlord and in the tenant portal. */
export function InspectionReadOnly({ inspection, items }: { inspection: InspectionVM; items: InspectionItemVM[] }) {
  const t = useTranslations("inspections");
  const f = useFormatter();
  const labels = useInspectionLabels(items);
  const rooms = groupByRoom(items);
  const day = (d: string) => f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-surface p-4 text-sm md:p-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("editor.date")}</dt>
            <dd className="text-foreground">{day(inspection.inspected_on)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("statusLabel")}</dt>
            <dd className="text-foreground">
              {inspection.landlord_signed_at ? t("completedOn", { date: day(inspection.landlord_signed_at) }) : t("status.draft")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("tenantLabel")}</dt>
            <dd className="text-foreground">
              {inspection.tenant_acknowledged_at
                ? t("ackBy", { name: inspection.tenant_ack_name ?? "", date: day(inspection.tenant_acknowledged_at) })
                : t("awaitingAck")}
            </dd>
          </div>
        </dl>
        {inspection.notes && <p className="mt-3 whitespace-pre-line border-t pt-3 text-foreground">{inspection.notes}</p>}
      </div>
      {rooms.map((r) => (
        <section key={r.room} className="rounded-xl border bg-surface p-4 md:p-5">
          <h2 className="mb-2 text-base font-semibold text-foreground">{labels.room(r.room)}</h2>
          <ul className="divide-y">
            {r.items.map((i) => {
              const worse = worsened(i.baseline?.condition, i.condition);
              return (
                <li key={i.id} className="space-y-1 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-foreground">{labels.item(i.item)}</span>
                    <span className={cn("font-medium", worse ? "text-danger" : "text-foreground")}>
                      {i.condition ? t(`condition.${i.condition}`) : "—"}
                      {i.baseline && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t("editor.moveIn", { condition: i.baseline.condition ? t(`condition.${i.baseline.condition}`) : "—" })}
                          {worse ? ` · ${t("editor.worse")}` : ""}
                        </span>
                      )}
                    </span>
                  </div>
                  {i.note && <p className="text-muted-foreground">{i.note}</p>}
                  {i.photos.length > 0 && <PhotoGrid photos={i.photos} altPrefix={labels.item(i.item)} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
