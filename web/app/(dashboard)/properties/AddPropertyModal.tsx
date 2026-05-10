"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, Loader2, X } from "lucide-react";

export default function AddPropertyModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "PR",
    zip: "",
    unit_count: 1,
  });
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("properties").insert({
      owner_id: userId,
      ...form,
    });
    setLoading(false);
    if (!error) {
      setOpen(false);
      setForm({ name: "", address: "", city: "", state: "PR", zip: "", unit_count: 1 });
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary-gradient flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add Property
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
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Add Property
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
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Property Name
                </label>
                <input
                  className="input-tonal"
                  placeholder="e.g. Sabana Gardens Apt 2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Street Address
                </label>
                <input
                  className="input-tonal"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    City
                  </label>
                  <input
                    className="input-tonal"
                    placeholder="San Juan"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    State
                  </label>
                  <input
                    className="input-tonal"
                    placeholder="PR"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    ZIP
                  </label>
                  <input
                    className="input-tonal"
                    placeholder="00901"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Units
                  </label>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    value={form.unit_count}
                    onChange={(e) => setForm({ ...form, unit_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn-tonal flex-1 justify-center"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-gradient flex-1 justify-center"
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
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
