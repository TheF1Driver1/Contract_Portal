"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, Loader2, X } from "lucide-react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

export default function AddPropertyModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    unit: "",
    city: "",
    state: "PR",
    zip: "",
    country: "US",
    unit_count: 1,
  });
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("properties").insert({
      owner_id: userId,
      name: form.name,
      address: form.address,
      unit: form.unit || null,
      city: form.city,
      state: form.state,
      zip: form.zip || null,
      country: form.country || null,
      unit_count: form.unit_count,
    });
    setLoading(false);
    if (!error) {
      setOpen(false);
      setForm({ name: "", address: "", unit: "", city: "", state: "PR", zip: "", country: "US", unit_count: 1 });
      router.refresh();
    }
  }

  const lbl = { color: "var(--text-secondary)" } as const;

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
            className="surface-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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
                <label className="text-xs font-medium" style={lbl}>Property Name</label>
                <input
                  className="input-tonal"
                  placeholder="e.g. Sabana Gardens Apt 2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <AddressAutocomplete
                    label="Street Address"
                    placeholder="123 Main St"
                    value={form.address}
                    onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                    onSelect={(parts) => setForm((f) => ({
                      ...f,
                      address: parts.street,
                      city: parts.city || f.city,
                      state: parts.state || f.state,
                      zip: parts.zip || f.zip,
                      country: parts.country || f.country,
                    }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Unit / Apt</label>
                  <input
                    className="input-tonal"
                    placeholder="Apt 2B"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>City</label>
                  <input
                    className="input-tonal"
                    placeholder="San Juan"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input
                    className="input-tonal"
                    placeholder="PR"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input
                    className="input-tonal"
                    placeholder="00901"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Country</label>
                  <input
                    className="input-tonal"
                    placeholder="US"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Units</label>
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
