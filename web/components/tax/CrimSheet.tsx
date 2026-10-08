"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, Clock, Loader2, Plus, AlertTriangle, type LucideIcon } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addCrimBill, markCrimBillPaid, saveCrimAccount, voidCrimBill } from "@/lib/actions/tax";
import { billStatus, estimateCrim, findRate, fiscalYearOf, recentFiscalYears, type BillStatus, type CrimRate } from "@/lib/tax/crim";
import type { CrimBill, PropertyCrim } from "@/lib/db";
import { cn } from "@/lib/utils";

export type CrimSheetData = {
  property: { id: string; name: string; city: string | null };
  account: PropertyCrim | null;
  bills: CrimBill[];
  rates: CrimRate[];
  today: string;
};

const STATUS: Record<BillStatus, { icon: LucideIcon; className: string }> = {
  paid: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  due: { icon: Clock, className: "bg-info-soft text-info" },
  overdue: { icon: AlertTriangle, className: "bg-danger-soft text-danger" },
  voided: { icon: Ban, className: "bg-surface-muted text-muted-foreground" },
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** CRIM account, estimate, bills and depreciation inputs for one property. */
export function CrimSheet({ data, open, onOpenChange }: { data: CrimSheetData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("tax.crim");
  const f = useFormatter();
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "medium" });
  const a = data.account;

  const [municipality, setMunicipality] = useState(a?.municipality ?? data.property.city ?? "");
  const [catastro, setCatastro] = useState(a?.catastro_number ?? "");
  const [account, setAccount] = useState(a?.account_number ?? "");
  const [assessed, setAssessed] = useState(str(a?.assessed_value));
  const [principal, setPrincipal] = useState(a?.exemption_principal_residence ?? false);
  const [exoneration, setExoneration] = useState(str(a?.exoneration_amount));
  const [notes, setNotes] = useState(a?.notes ?? "");
  const [purchase, setPurchase] = useState(str(a?.purchase_price));
  const [buildingPct, setBuildingPct] = useState(str(a?.building_pct));
  const [placed, setPlaced] = useState(a?.placed_in_service ?? "");
  const [saving, setSaving] = useState(false);

  const fy = fiscalYearOf(data.today);
  const rate = useMemo(() => findRate(data.rates, municipality, fy), [data.rates, municipality, fy]);
  const estimate = estimateCrim({ assessedValue: num(assessed), exoneration: num(exoneration), ratePct: rate?.ratePct });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveCrimAccount({
      property_id: data.property.id,
      municipality,
      catastro_number: catastro,
      account_number: account,
      assessed_value: num(assessed),
      exemption_principal_residence: principal,
      exoneration_amount: num(exoneration),
      notes,
      purchase_price: num(purchase),
      building_pct: num(buildingPct),
      placed_in_service: placed || null,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("account.saved"));
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={t("sheetTitle", { name: data.property.name })}
      description={t("sheetDescription")}
      footer={
        <Button type="submit" form="crim-account-form" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} {t("account.save")}
        </Button>
      }
    >
      <div className="space-y-6">
        <section aria-labelledby="crim-estimate" className="rounded-xl border border-border bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="crim-estimate" className="text-sm font-semibold text-foreground">
              {t("estimate.title")}
            </h3>
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("estimate.badge")}</span>
          </div>
          {estimate && rate ? (
            <>
              <p className="tabular mt-2 text-2xl font-semibold text-foreground">{money(estimate.annual)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("estimate.formula", { taxable: money(estimate.taxable), rate: rate.ratePct, municipality: rate.municipality, fy: rate.fiscalYear })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {!rate && municipality.trim() ? t("estimate.missingRate", { municipality }) : t("estimate.missingValue")}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("estimate.note")}</p>
        </section>

        <form id="crim-account-form" onSubmit={save} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold text-foreground">{t("account.title")}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="crim-municipality" label={t("account.municipality")}>
                <Input id="crim-municipality" value={municipality} onChange={(e) => setMunicipality(e.target.value)} maxLength={60} autoComplete="off" />
              </Field>
              <Field id="crim-catastro" label={t("account.catastro")}>
                <Input id="crim-catastro" value={catastro} onChange={(e) => setCatastro(e.target.value)} maxLength={40} />
              </Field>
              <Field id="crim-account" label={t("account.accountNumber")}>
                <Input id="crim-account" value={account} onChange={(e) => setAccount(e.target.value)} maxLength={40} />
              </Field>
              <Field id="crim-assessed" label={t("account.assessedValue")}>
                <Input id="crim-assessed" type="number" inputMode="decimal" min="0" step="0.01" value={assessed} onChange={(e) => setAssessed(e.target.value)} className="tabular" />
              </Field>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <Label htmlFor="crim-principal">{t("account.principalResidence")}</Label>
                <p className="text-sm text-muted-foreground">{t("account.principalResidenceHint")}</p>
              </div>
              <Switch
                id="crim-principal"
                checked={principal}
                onCheckedChange={(v) => {
                  setPrincipal(v);
                  if (v && exoneration === "") setExoneration("15000");
                }}
              />
            </div>
            <Field id="crim-exoneration" label={t("account.exoneration")} hint={t("account.exonerationHint")}>
              <Input id="crim-exoneration" type="number" inputMode="decimal" min="0" step="0.01" value={exoneration} onChange={(e) => setExoneration(e.target.value)} className="tabular" aria-describedby="crim-exoneration-hint" />
            </Field>
            <Field id="crim-notes" label={t("account.notes")}>
              <Textarea id="crim-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">{t("depreciation.title")}</legend>
            <p className="text-sm text-muted-foreground">{t("depreciation.hint")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field id="crim-purchase" label={t("depreciation.purchasePrice")}>
                <Input id="crim-purchase" type="number" inputMode="decimal" min="0" step="0.01" value={purchase} onChange={(e) => setPurchase(e.target.value)} className="tabular" />
              </Field>
              <Field id="crim-building" label={t("depreciation.buildingPct")}>
                <Input id="crim-building" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={buildingPct} onChange={(e) => setBuildingPct(e.target.value)} className="tabular" />
              </Field>
              <Field id="crim-placed" label={t("depreciation.placedInService")}>
                <Input id="crim-placed" type="date" max={data.today} value={placed} onChange={(e) => setPlaced(e.target.value)} />
              </Field>
            </div>
          </fieldset>
        </form>

        <Bills data={data} money={money} date={date} />
      </div>
    </FormSheet>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Bills({ data, money, date }: { data: CrimSheetData; money: (n: number) => string; date: (d: string) => string }) {
  const t = useTranslations("tax.crim.bills");
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<CrimBill | null>(null);
  const [voiding, setVoiding] = useState<CrimBill | null>(null);
  const bills = [...data.bills].sort((a, b) => b.due_date.localeCompare(a.due_date));

  return (
    <section aria-labelledby="crim-bills" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="crim-bills" className="text-sm font-semibold text-foreground">
          {t("title")}
        </h3>
        {!adding && (
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => setAdding(true)}>
            <Plus /> {t("add")}
          </Button>
        )}
      </div>
      {adding && <AddBillForm data={data} onDone={() => setAdding(false)} />}
      {bills.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {bills.map((b) => {
            const status = billStatus(b, data.today);
            const { icon: Icon, className } = STATUS[status];
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t("label", { fy: b.fiscal_year, n: b.installment })} · <span className="tabular">{money(Number(b.amount))}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.paid_on ? t("paidOnDate", { date: date(b.paid_on) }) : t("dueOn", { date: date(b.due_date) })}
                    {b.payment_reference ? ` · ${b.payment_reference}` : ""}
                    {b.void_reason ? ` · ${b.void_reason}` : ""}
                  </p>
                </div>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
                  <Icon className="size-3.5" aria-hidden />
                  {t(`status.${status}`)}
                </span>
                {status !== "voided" && (
                  <div className="flex gap-1">
                    {!b.paid_on && (
                      <Button type="button" size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => setPaying(b)}>
                        {t("markPaid")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-10 sm:h-8"
                      onClick={() => setVoiding(b)}
                      aria-label={t("voidAria", { fy: b.fiscal_year, n: b.installment })}
                    >
                      {t("void")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <PayDialog bill={paying} today={data.today} onClose={() => setPaying(null)} />
      <VoidBillDialog bill={voiding} onClose={() => setVoiding(null)} />
    </section>
  );
}

function AddBillForm({ data, onDone }: { data: CrimSheetData; onDone: () => void }) {
  const t = useTranslations("tax.crim.bills");
  const years = recentFiscalYears(data.today);
  const [fy, setFy] = useState(fiscalYearOf(data.today));
  const [installment, setInstallment] = useState("1");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await addCrimBill({ property_id: data.property.id, fiscal_year: fy, installment: Number(installment), amount: Number(amount), due_date: due });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("added"));
    onDone();
  }

  // Not a <form>: it sits next to the account form inside the sheet.
  return (
    <div role="group" aria-label={t("add")} className="space-y-3 rounded-lg border border-border bg-surface-muted p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="bill-fy">{t("fiscalYear")}</Label>
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger id="bill-fy" className="h-10 w-full tabular md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y} className="tabular">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-installment">{t("installment")}</Label>
          <Select value={installment} onValueChange={setInstallment}>
            <SelectTrigger id="bill-installment" className="h-10 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("installmentN", { n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-amount">{t("amount")}</Label>
          <Input id="bill-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-due">{t("dueDate")}</Label>
          <Input id="bill-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={submit} disabled={busy || !(Number(amount) > 0) || !due}>
          {busy && <Loader2 className="animate-spin" />} {t("save")}
        </Button>
      </div>
    </div>
  );
}

function PayDialog({ bill, today, onClose }: { bill: CrimBill | null; today: string; onClose: () => void }) {
  const t = useTranslations("tax.crim.bills");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [createExpense, setCreateExpense] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bill) return;
    setBusy(true);
    const res = await markCrimBillPaid({ id: bill.id, paid_on: paidOn, payment_reference: reference, create_expense: createExpense });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("paid"));
    setReference("");
    onClose();
  }

  return (
    <Dialog open={!!bill} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("markPaidTitle")}</DialogTitle>
            <DialogDescription>{bill ? t("label", { fy: bill.fiscal_year, n: bill.installment }) : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-date">{t("paidOn")}</Label>
              <Input id="pay-date" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">{t("reference")}</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="pay-expense" checked={createExpense} onCheckedChange={(v) => setCreateExpense(v === true)} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="pay-expense">{t("createExpense")}</Label>
              <p className="text-sm text-muted-foreground">{t("createExpenseHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !paidOn}>
              {busy && <Loader2 className="animate-spin" />} {t("confirmPaid")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoidBillDialog({ bill, onClose }: { bill: CrimBill | null; onClose: () => void }) {
  const t = useTranslations("tax.crim.bills");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bill) return;
    setBusy(true);
    const res = await voidCrimBill({ id: bill.id, reason });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    if (res.warning) toast.warning(res.warning);
    else toast.success(t("voided"));
    setReason("");
    onClose();
  }

  return (
    <Dialog open={!!bill} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("voidTitle")}</DialogTitle>
            <DialogDescription>{t("voidBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-bill-reason">{t("voidReason")}</Label>
            <Input id="void-bill-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>
              {busy && <Loader2 className="animate-spin" />} {t("voidConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
