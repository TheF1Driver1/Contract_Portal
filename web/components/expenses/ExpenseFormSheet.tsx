"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, ScanLine, Sparkles } from "lucide-react";
import type { Property, PropertyExpense } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export { EXPENSE_CATEGORIES };

export type EditableExpense = Pick<
  PropertyExpense,
  "id" | "property_id" | "category" | "amount" | "expense_date" | "description" | "vendor" | "is_tax_deductible"
>;

type FormState = {
  property_id: string;
  category: string;
  amount: string;
  expense_date: string;
  description: string;
  vendor: string;
  is_tax_deductible: boolean;
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initialState(properties: Pick<Property, "id" | "name">[], expense?: EditableExpense | null): FormState {
  if (expense) {
    return {
      property_id: expense.property_id,
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date.slice(0, 10),
      description: expense.description ?? "",
      vendor: expense.vendor ?? "",
      is_tax_deductible: expense.is_tax_deductible,
    };
  }
  return {
    property_id: properties[0]?.id ?? "",
    category: "maintenance",
    amount: "",
    expense_date: today(),
    description: "",
    vendor: "",
    is_tax_deductible: true,
  };
}

/** Create (expense = null) or edit an expense. Posts to /api/expenses as before. */
export function ExpenseFormSheet({
  open,
  onOpenChange,
  properties,
  expense,
  aiScan = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Pick<Property, "id" | "name">[];
  expense?: EditableExpense | null;
  /** Show "scan a receipt" (AI extraction) on new expenses. */
  aiScan?: boolean;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const router = useRouter();
  const editing = !!expense;
  const [form, setForm] = useState<FormState>(() => initialState(properties, expense));
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Reset the form each time the sheet opens (or switches to another expense).
  const openKey = open ? (expense?.id ?? "new") : null;
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (openKey) {
      setForm(initialState(properties, expense));
      setScanned(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function scan(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ai/receipt", { method: "POST", body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.draft) {
        const key = typeof d.error === "string" && ["unsupported_type", "too_large", "quota_exceeded", "unreadable", "refused"].includes(d.error) ? d.error : "failed";
        toast.error(t(`scan.errors.${key}`));
        return;
      }
      const r = d.draft as { is_receipt: boolean; vendor: string | null; date: string | null; total: number | null; category: string; description: string | null };
      if (!r.is_receipt) {
        toast.error(t("scan.errors.notReceipt"));
        return;
      }
      setForm((f) => ({
        ...f,
        vendor: r.vendor ?? f.vendor,
        expense_date: r.date ?? f.expense_date,
        amount: r.total !== null ? r.total.toFixed(2) : f.amount,
        category: r.category,
        description: r.description ?? f.description,
      }));
      setScanned(true);
    } catch {
      toast.error(t("scan.errors.failed"));
    } finally {
      setScanning(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(editing ? `/api/expenses/${expense!.id}` : "/api/expenses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          description: form.description || null,
          vendor: form.vendor || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : t("form.failed"));
      }
      toast.success(editing ? t("form.updated") : t("form.added"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(t("form.failed"), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  const noProperties = properties.length === 0;
  const formId = "expense-form";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("form.editTitle") : t("form.addTitle")}
      description={t("form.description")}
      footer={
        <>
          <Button type="button" variant="outline" className="h-10 md:h-9" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={formId} className="h-10 md:h-9" disabled={loading || noProperties}>
            {loading && <Loader2 className="animate-spin" />}
            {loading ? t("form.saving") : editing ? t("form.save") : t("form.add")}
          </Button>
        </>
      }
    >
      {noProperties ? (
        <div className="space-y-3 rounded-xl border bg-surface-muted p-4 text-sm">
          <p className="text-foreground">{t("form.noProperties")}</p>
          <Button asChild variant="outline">
            <Link href="/properties">{t("form.addProperty")}</Link>
          </Button>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} className="space-y-4">
          {aiScan && !editing && (
            <div className="rounded-xl border border-dashed bg-surface-muted p-3">
              <label
                htmlFor="expense-receipt"
                className="flex cursor-pointer items-center gap-3 text-sm has-[:disabled]:cursor-wait has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring rounded-lg"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  {scanning ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanLine className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{scanning ? t("scan.reading") : t("scan.title")}</span>
                  <span className="block text-xs text-muted-foreground">{t("scan.hint")}</span>
                </span>
              </label>
              <input
                id="expense-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="sr-only"
                disabled={scanning}
                onChange={(e) => {
                  void scan(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {scanned && (
                <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {t("scan.review")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="expense-property">{t("form.property")}</Label>
            <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
              <SelectTrigger id="expense-property" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">{t("form.category")}</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger id="expense-category" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">{t("form.amount")}</Label>
              <Input
                id="expense-amount"
                className="h-10 tabular"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-date">{t("form.date")}</Label>
            <Input
              id="expense-date"
              className="h-10"
              type="date"
              value={form.expense_date}
              onChange={(e) => set("expense_date", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-vendor">{t("form.vendor")}</Label>
            <Input
              id="expense-vendor"
              className="h-10"
              placeholder={t("form.optional")}
              maxLength={200}
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">{t("form.notes")}</Label>
            <Textarea
              id="expense-description"
              rows={3}
              placeholder={t("form.optional")}
              maxLength={1000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="expense-deductible"
              checked={form.is_tax_deductible}
              onCheckedChange={(v) => set("is_tax_deductible", v === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="expense-deductible">{t("form.deductible")}</Label>
              <p className="text-xs text-muted-foreground">{t("form.deductibleHint")}</p>
            </div>
          </div>
        </form>
      )}
    </FormSheet>
  );
}
