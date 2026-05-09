"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Pencil, Loader2, X, AlertTriangle } from "lucide-react";
import type { Property } from "@/lib/types";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

export default function EditPropertyModal({ property }: { property: Property }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: property.name,
    address: property.address,
    unit: property.unit ?? "",
    city: property.city,
    state: property.state,
    zip: property.zip ?? "",
    country: property.country ?? "US",
    unit_count: property.unit_count,
    bathroom_count: property.bathroom_count ?? 1,
    parking_available: property.parking_available ?? false,
    parking_count: property.parking_count ?? 0,
  });
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("properties")
      .update({
        name: form.name,
        address: form.address,
        unit: form.unit || null,
        city: form.city,
        state: form.state,
        zip: form.zip || null,
        country: form.country || null,
        unit_count: form.unit_count,
        bathroom_count: form.bathroom_count,
        parking_available: form.parking_available,
        parking_count: form.parking_available ? form.parking_count : null,
      })
      .eq("id", property.id);
    setLoading(false);
    if (!error) {
      setOpen(false);
      router.refresh();
    }
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
        style={{ background: "var(--surface-container)" }}
        title="Edit property"
      >
        <Pencil className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Edit Property
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            <div
              className="flex items-start gap-2 rounded-xl p-3 mb-4 text-xs"
              style={{ background: "rgba(255,204,0,0.10)", color: "var(--text-secondary)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#ffcc00" }} />
              Editing this property will not affect existing signed contracts.
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Property Name</label>
                <input
                  className="input-tonal"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <AddressAutocomplete
                    label="Street Address"
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
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input
                    className="input-tonal"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input
                    className="input-tonal"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                    onChange={(e) => setForm({ ...form, unit_count: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Bathrooms</label>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    max={20}
                    value={form.bathroom_count}
                    onChange={(e) => setForm({ ...form, bathroom_count: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Parking</label>
                <label
                  className="flex items-center gap-2.5 rounded-xl p-3 cursor-pointer transition-colors h-[42px]"
                  style={{ background: "var(--surface-container)" }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-[#007aff]"
                    checked={form.parking_available}
                    onChange={(e) => setForm({ ...form, parking_available: e.target.checked })}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Included</span>
                </label>
              </div>
              {form.parking_available && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Parking Spaces</label>
                  <input
                    className="input-tonal"
                    type="number"
                    min={0}
                    max={20}
                    value={form.parking_count}
                    onChange={(e) => setForm({ ...form, parking_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              )}

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
