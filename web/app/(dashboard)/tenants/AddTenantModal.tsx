"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Tenant
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Tenant</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="tenant@email.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    placeholder="+1 787 555 0100"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SSN Last 4</Label>
                  <Input
                    placeholder="6789"
                    maxLength={4}
                    value={form.ssn_last4}
                    onChange={(e) => update("ssn_last4", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>License #</Label>
                  <Input
                    placeholder="A1234567"
                    value={form.license_number}
                    onChange={(e) => update("license_number", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Current Address</Label>
                <Input
                  placeholder="Carolina, Puerto Rico"
                  value={form.current_address}
                  onChange={(e) => update("current_address", e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
