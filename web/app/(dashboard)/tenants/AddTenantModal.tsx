"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, Loader2, X } from "lucide-react";

export default function AddTenantModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    ssn_last4: "",
    license_number: "",
    current_address: "",
  });
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
    });
    setLoading(false);
    if (!error) {
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", ssn_last4: "", license_number: "", current_address: "" });
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary-gradient flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add Tenant
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.40)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-md p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Full Name
                </label>
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
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Email
                  </label>
                  <input
                    className="input-tonal"
                    type="email"
                    placeholder="tenant@email.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Phone
                  </label>
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
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    SSN Last 4
                  </label>
                  <input
                    className="input-tonal"
                    placeholder="6789"
                    maxLength={4}
                    value={form.ssn_last4}
                    onChange={(e) => update("ssn_last4", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    License #
                  </label>
                  <input
                    className="input-tonal"
                    placeholder="A1234567"
                    value={form.license_number}
                    onChange={(e) => update("license_number", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Current Address
                </label>
                <input
                  className="input-tonal"
                  placeholder="Carolina, Puerto Rico"
                  value={form.current_address}
                  onChange={(e) => update("current_address", e.target.value)}
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
        </div>
      )}
    </>
  );
}
