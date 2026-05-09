"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, Loader2, X } from "lucide-react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

function buildAddress(street: string, unit: string, city: string, state: string, zip: string, country: string) {
  return [street, unit, city, state, zip, country].filter(Boolean).join(", ");
}

const EMPTY_ADDR = { street: "", unit: "", city: "", state: "", zip: "", country: "US" };

export default function AddTenantModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    ssn_last4: "",
    license_number: "",
  });
  const [cur, setCur] = useState({ ...EMPTY_ADDR });
  const [prev, setPrev] = useState({ ...EMPTY_ADDR });
  const router = useRouter();
  const supabase = createClient();

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("tenants").insert({
      owner_id: userId,
      ...form,
      current_street: cur.street || null,
      current_unit: cur.unit || null,
      current_city: cur.city || null,
      current_state: cur.state || null,
      current_zip: cur.zip || null,
      current_country: cur.country || null,
      current_address: buildAddress(cur.street, cur.unit, cur.city, cur.state, cur.zip, cur.country) || null,
      previous_street: prev.street || null,
      previous_unit: prev.unit || null,
      previous_city: prev.city || null,
      previous_state: prev.state || null,
      previous_zip: prev.zip || null,
      previous_country: prev.country || null,
    });
    setLoading(false);
    if (!error) {
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", ssn_last4: "", license_number: "" });
      setCur({ ...EMPTY_ADDR });
      setPrev({ ...EMPTY_ADDR });
      router.refresh();
    }
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary-gradient flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add Tenant
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Add Tenant
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
                <label className="text-xs font-medium" style={lbl}>Full Name</label>
                <input
                  className="input-tonal"
                  placeholder="Juan Pérez"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Email</label>
                  <input
                    className="input-tonal"
                    type="email"
                    placeholder="tenant@email.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Phone</label>
                  <input
                    className="input-tonal"
                    type="tel"
                    placeholder="+1 787 555 0100"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>SSN Last 4</label>
                  <input
                    className="input-tonal"
                    placeholder="6789"
                    maxLength={4}
                    value={form.ssn_last4}
                    onChange={(e) => update("ssn_last4", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>License #</label>
                  <input
                    className="input-tonal"
                    placeholder="A1234567"
                    value={form.license_number}
                    onChange={(e) => update("license_number", e.target.value)}
                  />
                </div>
              </div>

              {/* Current Address */}
              <p className="text-[10px] font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--text-muted)" }}>
                Current Address
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <AddressAutocomplete
                    label="Street"
                    placeholder="123 Main St"
                    value={cur.street}
                    onChange={(v) => setCur((a) => ({ ...a, street: v }))}
                    onSelect={(parts) => setCur((a) => ({ ...a, ...parts }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Unit / Apt</label>
                  <input
                    className="input-tonal"
                    placeholder="Apt 2B"
                    value={cur.unit}
                    onChange={(e) => setCur((a) => ({ ...a, unit: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>City</label>
                  <input
                    className="input-tonal"
                    placeholder="San Juan"
                    value={cur.city}
                    onChange={(e) => setCur((a) => ({ ...a, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input
                    className="input-tonal"
                    placeholder="PR"
                    value={cur.state}
                    onChange={(e) => setCur((a) => ({ ...a, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input
                    className="input-tonal"
                    placeholder="00901"
                    value={cur.zip}
                    onChange={(e) => setCur((a) => ({ ...a, zip: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Country</label>
                <input
                  className="input-tonal"
                  placeholder="US"
                  value={cur.country}
                  onChange={(e) => setCur((a) => ({ ...a, country: e.target.value }))}
                />
              </div>

              {/* Previous Address */}
              <p className="text-[10px] font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--text-muted)" }}>
                Previous Address
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <AddressAutocomplete
                    label="Street"
                    placeholder="456 Old Road"
                    value={prev.street}
                    onChange={(v) => setPrev((a) => ({ ...a, street: v }))}
                    onSelect={(parts) => setPrev((a) => ({ ...a, ...parts }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Unit / Apt</label>
                  <input
                    className="input-tonal"
                    placeholder="Apt 1A"
                    value={prev.unit}
                    onChange={(e) => setPrev((a) => ({ ...a, unit: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>City</label>
                  <input
                    className="input-tonal"
                    placeholder="San Juan"
                    value={prev.city}
                    onChange={(e) => setPrev((a) => ({ ...a, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input
                    className="input-tonal"
                    placeholder="PR"
                    value={prev.state}
                    onChange={(e) => setPrev((a) => ({ ...a, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input
                    className="input-tonal"
                    placeholder="00901"
                    value={prev.zip}
                    onChange={(e) => setPrev((a) => ({ ...a, zip: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Country</label>
                <input
                  className="input-tonal"
                  placeholder="US"
                  value={prev.country}
                  onChange={(e) => setPrev((a) => ({ ...a, country: e.target.value }))}
                />
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
