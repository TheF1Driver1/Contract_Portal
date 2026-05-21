"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, X } from "lucide-react";
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
  expense: Pick<PropertyExpense, "id" | "property_id" | "category" | "amount" | "expense_date" | "description" | "vendor" | "is_tax_deductible">;
  properties: Pick<Property, "id" | "name">[];
}

export default function EditExpenseButton({ expense, properties }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setOpen(true);
  }

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          description: form.description || null,
          vendor: form.vendor || null,
        }),
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
