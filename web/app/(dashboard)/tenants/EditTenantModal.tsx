"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Pencil, Loader2, X, AlertTriangle } from "lucide-react";
import type { Tenant } from "@/lib/types";

export default function EditTenantModal({ tenant }: { tenant: Tenant }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: tenant.full_name,
    email: tenant.email ?? "",
    phone: tenant.phone ?? "",
    ssn_last4: tenant.ssn_last4 ?? "",
    license_number: tenant.license_number ?? "",
    current_address: tenant.current_address ?? "",
    date_of_birth: tenant.date_of_birth ?? "",
    employer_name: tenant.employer_name ?? "",
    employer_phone: tenant.employer_phone ?? "",
    monthly_income: tenant.monthly_income != null ? String(tenant.monthly_income) : "",
    emergency_contact_name: tenant.emergency_contact_name ?? "",
    emergency_contact_phone: tenant.emergency_contact_phone ?? "",
  });
  const router = useRouter();
  const supabase = createClient();

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
        current_address: form.current_address || null,
        date_of_birth: form.date_of_birth || null,
        employer_name: form.employer_name || null,
        employer_phone: form.employer_phone || null,
        monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      })
      .eq("id", tenant.id);
    setLoading(false);
    if (!error) {
      setOpen(false);
      router.refresh();
    }
  }

  const labelStyle = { color: "var(--text-secondary)" } as const;

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
            {/* Header */}
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

            {/* Warning */}
            <div
              className="flex items-start gap-2 rounded-xl p-3 mb-4 text-xs"
              style={{ background: "rgba(255,204,0,0.10)", color: "var(--text-secondary)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#ffcc00" }} />
              Editing tenant details will not affect existing signed contracts.
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Basic Info */}
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Basic Info
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={labelStyle}>Full Name</label>
                <input className="input-tonal" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Email</label>
                  <input className="input-tonal" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Phone</label>
                  <input className="input-tonal" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>SSN Last 4</label>
                  <input className="input-tonal" maxLength={4} value={form.ssn_last4} onChange={(e) => update("ssn_last4", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>License #</label>
                  <input className="input-tonal" value={form.license_number} onChange={(e) => update("license_number", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={labelStyle}>Current Address</label>
                <input className="input-tonal" value={form.current_address} onChange={(e) => update("current_address", e.target.value)} />
              </div>

              {/* Additional Info */}
              <p className="text-[10px] font-semibold uppercase tracking-widest pt-2" style={{ color: "var(--text-muted)" }}>
                Additional Info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Date of Birth</label>
                  <input className="input-tonal" type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Monthly Income ($)</label>
                  <input className="input-tonal" type="number" min={0} step={0.01} value={form.monthly_income} onChange={(e) => update("monthly_income", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Employer Name</label>
                  <input className="input-tonal" value={form.employer_name} onChange={(e) => update("employer_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Employer Phone</label>
                  <input className="input-tonal" type="tel" value={form.employer_phone} onChange={(e) => update("employer_phone", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Emergency Contact</label>
                  <input className="input-tonal" placeholder="Name" value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={labelStyle}>Emergency Phone</label>
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
