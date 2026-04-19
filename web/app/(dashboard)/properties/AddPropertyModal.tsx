"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Property
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Property</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Property Name</Label>
                <Input
                  placeholder="e.g. Sabana Gardens Apt 2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    placeholder="San Juan"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    placeholder="PR"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input
                    placeholder="00901"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Units</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.unit_count}
                    onChange={(e) => setForm({ ...form, unit_count: parseInt(e.target.value) })}
                  />
                </div>
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
