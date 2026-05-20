"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { Property } from "@/lib/types";

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
  properties: Pick<Property, "id" | "name">[];
}

export default function AddExpenseModal({ properties }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    property_id: properties[0]?.id ?? "",
    category: "maintenance" as string,
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    description: "",
    vendor: "",
    is_tax_deductible: true,
  });

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
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
        throw new Error(d.error ?? "Failed to save expense");
      }
      setOpen(false);
      setForm({ property_id: properties[0]?.id ?? "", category: "maintenance", amount: "", expense_date: new Date().toISOString().slice(0, 10), description: "", vendor: "", is_tax_deductible: true });
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
        onClick={() => setOpen(true)}
        className="btn-primary-gradient flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Expense
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-slide-up"
            style={{ background: "var(--surface-card)", border: "1px solid rgba(255,255,255,0.07)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Add Expense
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Property */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Property
                </label>
                <select
                  value={form.property_id}
                  onChange={(e) => set("property_id", e.target.value)}
                  className="input-field w-full"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Category + Amount row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    className="input-field w-full"
                    required
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Date
                </label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => set("expense_date", e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>

              {/* Vendor + Description row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={form.vendor}
                    onChange={(e) => set("vendor", e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>

              {/* Tax deductible toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_tax_deductible}
                  onChange={(e) => set("is_tax_deductible", e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-500"
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Tax deductible
                </span>
              </label>

              {error && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-primary-gradient"
                >
                  {loading ? "Saving…" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
