"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { UserPlus, X, Search, Loader2 } from "lucide-react";

interface ProfileResult {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string;
}

export default function InviteMemberModal({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_profiles", { query: searchQuery.trim() });
      setSearchResults((data ?? []) as ProfileResult[]);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, supabase]);

  async function invite() {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("business_group_members").insert({
      group_id: groupId,
      user_id: selectedUser.id,
      role,
      status: "pending",
      invited_by: user?.id ?? null,
      invited_at: new Date().toISOString(),
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setOpen(false);
    setSelectedUser(null);
    setSearchQuery("");
    router.refresh();
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button
        className="btn-tonal flex items-center gap-2 text-sm"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        Invite Member
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
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Invite Member
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {/* Email search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={lbl}>Search by Email</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                <input
                  className="input-tonal pl-9"
                  placeholder="@username or email"
                  value={selectedUser ? `@${selectedUser.username ?? selectedUser.email}` : searchQuery}
                  onChange={(e) => { setSelectedUser(null); setSearchQuery(e.target.value); }}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />}
              </div>
              {!selectedUser && searchResults.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left px-3 py-2 hover:opacity-80"
                      style={{ background: "var(--surface)" }}
                      onClick={() => { setSelectedUser(r); setSearchResults([]); }}
                    >
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {r.username ? `@${r.username}` : r.email}
                        {r.full_name && <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{r.full_name}</span>}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={lbl}>Role</label>
              <div className="flex gap-2">
                {(["member", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="flex-1 rounded-xl py-2 text-sm font-medium capitalize transition-all"
                    style={{
                      background: role === r ? "rgba(0,122,255,0.15)" : "var(--surface-container)",
                      color: role === r ? "#007aff" : "var(--text-secondary)",
                      border: `1px solid ${role === r ? "rgba(0,122,255,0.30)" : "transparent"}`,
                    }}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            <div className="flex gap-3">
              <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className="btn-primary-gradient flex-1 justify-center"
                disabled={!selectedUser || saving}
                onClick={invite}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Invite
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
