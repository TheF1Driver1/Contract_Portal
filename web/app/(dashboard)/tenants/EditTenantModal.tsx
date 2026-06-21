"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Pencil, Loader2, X, AlertTriangle } from "lucide-react";
import type { Tenant } from "@/lib/types";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

function buildAddress(street: string, unit: string, city: string, state: string, zip: string, country: string) {
  return [street, unit, city, state, zip, country].filter(Boolean).join(", ");
}

export default function EditTenantModal({ tenant }: { tenant: Tenant }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: tenant.full_name,
    email: tenant.email ?? "",
    phone: tenant.phone ?? "",
    ssn_last4: tenant.ssn_last4 ?? "",
    license_number: tenant.license_number ?? "",
    date_of_birth: tenant.date_of_birth ?? "",
    employer_name: tenant.employer_name ?? "",
    employer_phone: tenant.employer_phone ?? "",
    monthly_income: tenant.monthly_income != null ? String(tenant.monthly_income) : "",
    emergency_contact_name: tenant.emergency_contact_name ?? "",
    emergency_contact_phone: tenant.emergency_contact_phone ?? "",
  });
  const [cur, setCur] = useState({
    street: tenant.current_street ?? "",
    unit: tenant.current_unit ?? "",
    city: tenant.current_city ?? "",
    state: tenant.current_state ?? "",
    zip: tenant.current_zip ?? "",
    country: tenant.current_country ?? "US",
  });
  const [prev, setPrev] = useState({
    street: tenant.previous_street ?? "",
    unit: tenant.previous_unit ?? "",
    city: tenant.previous_city ?? "",
    state: tenant.previous_state ?? "",
    zip: tenant.previous_zip ?? "",
    country: tenant.previous_country ?? "US",
  });
  const router = useRouter();
  const supabase = createBrowserClient();

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        ssn_last4: form.ssn_last4 || null,
        license_number: form.license_number || null,
        date_of_birth: form.date_of_birth || null,
        employer_name: form.employer_name || null,
        employer_phone: form.employer_phone || null,
        monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
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
      })
      .eq("id", tenant.id);
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
        title="Edit tenant"
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
            className="surface-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Edit Tenant
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
              Editing tenant details will not affect existing signed contracts.
            </div>

            <form onSubmit={submit} className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Basic Info
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Full Name</label>
                <input className="input-tonal" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Email</label>
                  <input className="input-tonal" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Phone</label>
                  <input className="input-tonal" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>SSN Last 4</label>
                  <input className="input-tonal" maxLength={4} value={form.ssn_last4} onChange={(e) => update("ssn_last4", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>License #</label>
                  <input className="input-tonal" value={form.license_number} onChange={(e) => update("license_number", e.target.value)} />
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
                  <input className="input-tonal" placeholder="San Juan" value={cur.city} onChange={(e) => setCur((a) => ({ ...a, city: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input className="input-tonal" placeholder="PR" value={cur.state} onChange={(e) => setCur((a) => ({ ...a, state: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input className="input-tonal" placeholder="00901" value={cur.zip} onChange={(e) => setCur((a) => ({ ...a, zip: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Country</label>
                <input className="input-tonal" placeholder="US" value={cur.country} onChange={(e) => setCur((a) => ({ ...a, country: e.target.value }))} />
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
                  <input className="input-tonal" placeholder="San Juan" value={prev.city} onChange={(e) => setPrev((a) => ({ ...a, city: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>State</label>
                  <input className="input-tonal" placeholder="PR" value={prev.state} onChange={(e) => setPrev((a) => ({ ...a, state: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>ZIP</label>
                  <input className="input-tonal" placeholder="00901" value={prev.zip} onChange={(e) => setPrev((a) => ({ ...a, zip: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Country</label>
                <input className="input-tonal" placeholder="US" value={prev.country} onChange={(e) => setPrev((a) => ({ ...a, country: e.target.value }))} />
              </div>

              {/* Additional Info */}
              <p className="text-[10px] font-semibold uppercase tracking-widest pt-2" style={{ color: "var(--text-muted)" }}>
                Additional Info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Date of Birth</label>
                  <input className="input-tonal" type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Monthly Income ($)</label>
                  <input className="input-tonal" type="number" min={0} step={0.01} value={form.monthly_income} onChange={(e) => update("monthly_income", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Employer Name</label>
                  <input className="input-tonal" value={form.employer_name} onChange={(e) => update("employer_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Employer Phone</label>
                  <input className="input-tonal" type="tel" value={form.employer_phone} onChange={(e) => update("employer_phone", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Emergency Contact</label>
                  <input className="input-tonal" placeholder="Name" value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Emergency Phone</label>
                  <input className="input-tonal" type="tel" value={form.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>
                  Cancel
                </button>
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
