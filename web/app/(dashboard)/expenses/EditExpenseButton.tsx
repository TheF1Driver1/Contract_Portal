"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, X, ScanLine, Receipt, ImageIcon } from "lucide-react";
import type { Property, PropertyExpense } from "@/lib/types";

const CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "taxes", label: "Taxes" },
  { value: "hoa", label: "HOA" },
  { value: "repairs", label: "Repairs" },
  { value: "management", label: "Management" },
  { value: "advertising", label: "Advertising" },
  { value: "mortgage", label: "Mortgage" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  expense: Pick<PropertyExpense, "id" | "property_id" | "category" | "amount" | "expense_date" | "description" | "vendor" | "is_tax_deductible" | "receipt_url">;
  properties: Pick<Property, "id" | "name">[];
  receiptPreviewUrl?: string | null;
}

export default function EditExpenseButton({ expense, properties, receiptPreviewUrl }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newReceipt, setNewReceipt] = useState<{ storage_path: string; preview_url: string | null } | null>(null);

  const [form, setForm] = useState({
    property_id: expense.property_id,
    category: expense.category as string,
    amount: String(expense.amount),
    expense_date: expense.expense_date.slice(0, 10),
    description: expense.description ?? "",
    vendor: expense.vendor ?? "",
    is_tax_deductible: expense.is_tax_deductible,
  });

  function openModal() {
    setForm({
      property_id: expense.property_id,
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date.slice(0, 10),
      description: expense.description ?? "",
      vendor: expense.vendor ?? "",
      is_tax_deductible: expense.is_tax_deductible,
    });
    setNewReceipt(null);
    setError(null);
    setOpen(true);
  }

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/expenses/scan-receipt", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to scan receipt");
      }
      const data = await res.json();
      setNewReceipt({ storage_path: data.storage_path, preview_url: data.preview_url });
      const ex = data.extracted ?? {};
      if (ex.amount != null) set("amount", String(ex.amount));
      if (ex.vendor) set("vendor", ex.vendor);
      if (ex.expense_date) set("expense_date", ex.expense_date);
      if (ex.category) set("category", ex.category);
      if (ex.description) set("description", ex.description);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ...form,
        amount: parseFloat(form.amount),
        description: form.description || null,
        vendor: form.vendor || null,
      };
      if (newReceipt) body.receipt_url = newReceipt.storage_path;
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to update expense");
      }
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const currentPreview = newReceipt?.preview_url ?? receiptPreviewUrl;
  const hasReceipt = !!(newReceipt?.storage_path ?? expense.receipt_url);

  return (
    <>
      <button
        onClick={openModal}
        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-blue-500/20"
        aria-label="Edit expense"
      >
        <Pencil className="h-3.5 w-3.5" style={{ color: "#3b82f6" }} />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Edit Expense
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {/* Receipt scan area */}
            <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {currentPreview ? (
                <div className="relative">
                  <img src={currentPreview} alt="Receipt" className="w-full max-h-32 object-cover" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={scanning}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                    style={{ background: "rgba(0,0,0,0.70)", color: "#fff" }}
                  >
                    {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
                    {scanning ? "Scanning…" : "Replace"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={scanning}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {scanning ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Scanning receipt…</>
                  ) : (
                    <><ScanLine className="h-3.5 w-3.5" />{hasReceipt ? "Receipt attached" : "Scan Receipt"} — auto-fill fields</>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleReceiptUpload}
            />

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Property</label>
                <select className="input-tonal" value={form.property_id} onChange={(e) => set("property_id", e.target.value)} required>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Category</label>
                  <select className="input-tonal" value={form.category} onChange={(e) => set("category", e.target.value)} required>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Amount ($)</label>
                  <input
                    className="input-tonal"
                    type="number"
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
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Date</label>
                <input className="input-tonal" type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Vendor</label>
                  <input className="input-tonal" type="text" placeholder="Optional" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Description</label>
                  <input className="input-tonal" type="text" placeholder="Optional" value={form.description} onChange={(e) => set("description", e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_tax_deductible}
                  onChange={(e) => set("is_tax_deductible", e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Tax deductible</span>
              </label>

              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-gradient flex-1 justify-center" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
