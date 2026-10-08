"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Camera, ClipboardList, History, Loader2, Phone, Receipt, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/app/FormSheet";
import { MaintenanceStatusBadge, UrgencyBadge } from "@/components/maintenance/Badges";
import { PhotoGrid, PhotoPicker, uploadPhoto } from "@/components/maintenance/PhotoPicker";
import { Timeline } from "@/components/maintenance/Timeline";
import { addMaintenanceNote, recordMaintenanceExpense, updateMaintenanceRequest } from "@/lib/actions/maintenance";
import { MAX_PHOTOS_PER_RECORD, nextStatuses, URGENCIES } from "@/lib/maintenance/logic";
import type { MaintenanceRequest, MaintenanceStatus, MaintenanceUpdate, MaintenanceUrgency } from "@/lib/db";

export function RequestDetail({
  request: r,
  updates,
  photos,
  property,
  address,
  tenant,
  expense,
  today,
}: {
  request: MaintenanceRequest;
  updates: MaintenanceUpdate[];
  photos: { id: string; url: string | null; renderable: boolean }[];
  property: string;
  address: string;
  tenant: { name: string; phone: string | null; email: string | null } | null;
  expense: { amount: number; date: string } | null;
  today: string;
}) {
  const t = useTranslations("maintenance");
  const f = useFormatter();
  const router = useRouter();
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string) => f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" });

  const [status, setStatus] = useState<MaintenanceStatus>(r.status);
  const [urgency, setUrgency] = useState<MaintenanceUrgency>(r.urgency);
  const [vendor, setVendor] = useState(r.vendor_name ?? "");
  const [vendorPhone, setVendorPhone] = useState(r.vendor_phone ?? "");
  const [scheduled, setScheduled] = useState(r.scheduled_for ?? "");
  const [cost, setCost] = useState(r.cost != null ? String(r.cost) : "");
  const [statusNote, setStatusNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateMaintenanceRequest({
      id: r.id,
      status,
      urgency,
      vendor_name: vendor,
      vendor_phone: vendorPhone,
      scheduled_for: scheduled || null,
      cost: r.expense_id ? undefined : cost === "" ? null : Number(cost),
      note: statusNote,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    if (res.warning) toast.warning(res.warning);
    else toast.success(t("detail.saved"));
    setStatusNote("");
    router.refresh();
  }

  async function addPhotos(files: File[]) {
    setUploading(true);
    for (const file of files.slice(0, MAX_PHOTOS_PER_RECORD - photos.length)) {
      const res = await uploadPhoto("maintenance", r.id, file);
      if (!res.ok) toast.error(t("form.photoFailed", { name: file.name, error: res.error }));
    }
    setUploading(false);
    router.refresh();
  }

  const statusOptions: MaintenanceStatus[] = [r.status, ...nextStatuses(r.status)];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/maintenance">
            <ArrowLeft aria-hidden />
            {t("detail.back")}
          </Link>
        </Button>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{r.title}</h1>
            <MaintenanceStatusBadge status={r.status} />
            <UrgencyBadge urgency={r.urgency} />
          </div>
          <p className="text-sm text-muted-foreground">
            {property}
            {tenant?.name ? ` · ${tenant.name}` : ""} · {t(`category.${r.category}`)} ·{" "}
            {t("detail.filed", { date: date(r.created_at), by: r.submitted_by_kind === "tenant" ? t("fromTenant") : t("fromLandlord") })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card icon={<ClipboardList />} title={t("detail.details")}>
            <p className="whitespace-pre-line text-sm text-foreground">{r.description || t("detail.noDescription")}</p>
            <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
              {address && <Info label={t("detail.address")} value={address} />}
              {tenant?.phone && (
                <Info label={t("detail.tenantPhone")} value={<a className="text-primary underline-offset-4 hover:underline" href={`tel:${tenant.phone}`}>{tenant.phone}</a>} />
              )}
              {tenant?.email && <Info label={t("detail.tenantEmail")} value={tenant.email} />}
              {r.contract_id && (
                <Info label={t("detail.lease")} value={<Link className="text-primary underline-offset-4 hover:underline" href={`/contracts/${r.contract_id}`}>{t("detail.viewLease")}</Link>} />
              )}
            </dl>
          </Card>

          <Card icon={<Camera />} title={t("detail.photos")}>
            {photos.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">{t("detail.noPhotos")}</p>
            ) : (
              <div className="mb-3">
                <PhotoGrid photos={photos} altPrefix={t("detail.photoAlt")} />
              </div>
            )}
            <PhotoPicker onFiles={addPhotos} busy={uploading} disabled={photos.length >= MAX_PHOTOS_PER_RECORD} />
          </Card>

          <Card icon={<History />} title={t("detail.timeline")}>
            <Timeline updates={updates} />
            <NoteForm requestId={r.id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={<Settings2 />} title={t("detail.manage")}>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m-status">{t("col.status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as MaintenanceStatus)}>
                  <SelectTrigger id="m-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(status === "scheduled" || status === "resolved") && status !== r.status && r.contract_id && (
                  <p className="text-xs text-muted-foreground">{t("detail.tenantNotified")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-urgency">{t("col.urgency")}</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as MaintenanceUrgency)}>
                  <SelectTrigger id="m-urgency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCIES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {t(`urgency.${u}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-vendor">{t("detail.vendor")}</Label>
                <Input id="m-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={120} autoComplete="organization" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-vendor-phone">{t("detail.vendorPhone")}</Label>
                <div className="flex gap-2">
                  <Input id="m-vendor-phone" type="tel" inputMode="tel" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} maxLength={30} />
                  {r.vendor_phone && (
                    <Button asChild variant="outline" size="icon" className="shrink-0">
                      <a href={`tel:${r.vendor_phone}`} aria-label={t("detail.call", { vendor: r.vendor_name || r.vendor_phone })}>
                        <Phone aria-hidden />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-date">{t("detail.scheduledFor")}</Label>
                  <Input id="m-date" type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-cost">{t("detail.cost")}</Label>
                  <Input id="m-cost" type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} disabled={!!r.expense_id} className="tabular" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-note">{t("detail.statusNote")}</Label>
                <Textarea id="m-note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} maxLength={2000} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {t("detail.save")}
              </Button>
            </form>
          </Card>

          <Card icon={<Receipt />} title={t("detail.expense.title")}>
            {expense ? (
              <div className="space-y-2 text-sm">
                <p>{t("detail.expense.linked", { amount: money(expense.amount), date: date(expense.date) })}</p>
                <Link href="/expenses" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("detail.expense.view")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{r.cost != null ? t("detail.expense.ready", { amount: money(r.cost) }) : t("detail.expense.noCost")}</p>
                <Button variant="outline" className="w-full" onClick={() => setExpenseOpen(true)}>
                  {t("detail.expense.record")}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ExpenseSheet open={expenseOpen} onOpenChange={setExpenseOpen} requestId={r.id} suggested={r.cost} today={today} />
    </div>
  );
}

function NoteForm({ requestId }: { requestId: string }) {
  const t = useTranslations("maintenance.detail");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addMaintenanceNote({ id: requestId, note });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("noteAdded"));
    setNote("");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t pt-4">
      <Label htmlFor={`note-${requestId}`}>{t("note")}</Label>
      <Textarea id={`note-${requestId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder={t("notePlaceholder")} />
      <div className="flex justify-end">
        <Button type="submit" variant="outline" size="sm" disabled={busy || !note.trim()}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t("addNote")}
        </Button>
      </div>
    </form>
  );
}

function ExpenseSheet({
  open,
  onOpenChange,
  requestId,
  suggested,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requestId: string;
  suggested: number | null;
  today: string;
}) {
  const t = useTranslations("maintenance.detail.expense");
  const router = useRouter();
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<"repairs" | "maintenance">("repairs");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await recordMaintenanceExpense({ id: requestId, amount: Number(amount), expense_date: date, category });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("saved"));
    onOpenChange(false);
    router.refresh();
  }
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("sheetTitle")}
      description={t("sheetDescription")}
      footer={
        <Button type="submit" form="maint-expense-form" disabled={busy || !(Number(amount) > 0)}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t("save")}
        </Button>
      }
    >
      <form id="maint-expense-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="exp-amount">{t("amount")}</Label>
            <Input id="exp-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="tabular" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-date">{t("date")}</Label>
            <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-category">{t("category")}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as "repairs" | "maintenance")}>
            <SelectTrigger id="exp-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="repairs">{t("catRepairs")}</SelectItem>
              <SelectItem value="maintenance">{t("catMaintenance")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">{t("hint")}</p>
      </form>
    </FormSheet>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-surface p-4 md:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}
