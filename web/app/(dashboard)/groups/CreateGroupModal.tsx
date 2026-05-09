"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Plus, X, Loader2 } from "lucide-react";

export default function CreateGroupModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: group, error: groupErr } = await supabase
      .from("business_groups")
      .insert({ name: name.trim(), created_by: user.id })
      .select()
      .single();

    if (groupErr || !group) {
      setError(groupErr?.message ?? "Failed to create group");
      setSaving(false);
      return;
    }

    // Auto-add creator as owner member
    await supabase.from("business_group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "owner",
    });

    setSaving(false);
    setOpen(false);
    setName("");
    router.push(`/groups/${group.id}`);
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button className="btn-primary-gradient flex items-center gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Group
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Create Group
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Group Name</label>
                <input
                  className="input-tonal"
                  placeholder="e.g. Downtown Portfolio LLC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-gradient flex-1 justify-center" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
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
