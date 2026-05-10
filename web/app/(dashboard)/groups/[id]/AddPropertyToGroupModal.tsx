"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, X, Loader2 } from "lucide-react";
import type { Property } from "@/lib/types";

export default function AddPropertyToGroupModal({
  groupId,
  availableProperties,
}: {
  groupId: string;
  availableProperties: Property[];
}) {
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function add() {
    if (!propertyId) return;
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    const { error: err } = await supabase.from("business_group_properties").insert({
      group_id: groupId,
      property_id: propertyId,
      added_by: user?.id,
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    setOpen(false);
    setPropertyId("");
    router.refresh();
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button className="btn-tonal flex items-center gap-2 text-sm" onClick={() => setOpen(true)}>
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
            className="surface-card w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Add Property</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={lbl}>Property</label>
              <select
                className="input-tonal"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">Select a property…</option>
                {availableProperties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.city}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            {availableProperties.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                All your properties are already in this group.
              </p>
            )}

            <div className="flex gap-3">
              <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className="btn-primary-gradient flex-1 justify-center"
                disabled={!propertyId || saving}
                onClick={add}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
