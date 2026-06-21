"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Users, X, Search, Loader2, Trash2, Check, Clock } from "lucide-react";
import type { Property, PropertyCoOwner } from "@/lib/types";

interface ProfileResult {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string;
}

export default function CoOwnersModal({ property }: { property: Property }) {
  const [open, setOpen] = useState(false);
  const [coOwners, setCoOwners] = useState<PropertyCoOwner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [ownershipPct, setOwnershipPct] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const fetchCoOwners = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("property_co_owners")
      .select("*, co_owner:profiles!property_co_owners_co_owner_id_fkey(id, full_name, email)")
      .eq("property_id", property.id)
      .order("invited_at", { ascending: false });
    setCoOwners((data ?? []) as PropertyCoOwner[]);
    setLoading(false);
  }, [property.id, supabase]);

  useEffect(() => {
    if (open) fetchCoOwners();
  }, [open, fetchCoOwners]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_profiles", {
        query: searchQuery.trim(),
      });
      setSearchResults((data ?? []) as ProfileResult[]);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, supabase]);

  async function addCoOwner() {
    if (!selectedUser) return;
    const pct = parseFloat(ownershipPct);
    if (!pct || pct <= 0 || pct > 100) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("property_co_owners").insert({
      property_id: property.id,
      owner_id: user.id,
      co_owner_id: selectedUser.id,
      ownership_pct: pct,
    });
    setSaving(false);
    if (!error) {
      setSelectedUser(null);
      setSearchQuery("");
      setOwnershipPct("");
      setSearchResults([]);
      await fetchCoOwners();
      router.refresh();
    }
  }

  async function removeCoOwner(id: string) {
    await supabase.from("property_co_owners").delete().eq("id", id);
    await fetchCoOwners();
    router.refresh();
  }

  const lbl = { color: "var(--text-secondary)" } as const;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
        style={{ background: "var(--surface-container)" }}
        title="Manage co-owners"
      >
        <Users className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
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
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Co-Owners
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {property.name}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {/* Current co-owners */}
            <div className="mb-5">
              <p className="text-xs font-medium mb-2" style={lbl}>Current Co-Owners</p>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
              ) : coOwners.length === 0 ? (
                <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
                  No co-owners added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {coOwners.map((co) => (
                    <div
                      key={co.id}
                      className="flex items-center justify-between rounded-xl p-3"
                      style={{ background: "var(--surface-container)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {co.co_owner?.full_name ?? co.co_owner?.email}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {co.co_owner?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: "rgba(0,122,255,0.12)", color: "#007aff" }}
                        >
                          {co.ownership_pct}%
                        </span>
                        {co.status === "accepted" ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "#22c55e" }}>
                            <Check className="h-3 w-3" /> Active
                          </span>
                        ) : co.status === "declined" ? (
                          <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>Declined</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                        <button
                          onClick={() => removeCoOwner(co.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg transition-opacity hover:opacity-60"
                          style={{ background: "rgba(239,68,68,0.10)" }}
                        >
                          <Trash2 className="h-3 w-3" style={{ color: "#ef4444" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new co-owner */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--surface-container)" }}
            >
              <p className="text-xs font-medium" style={lbl}>Add Co-Owner</p>

              {/* Email search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                <input
                  className="input-tonal pl-9"
                  placeholder="Search by @username or email…"
                  value={selectedUser ? `@${selectedUser.username ?? selectedUser.email}` : searchQuery}
                  onChange={(e) => {
                    setSelectedUser(null);
                    setSearchQuery(e.target.value);
                  }}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
                )}
              </div>

              {/* Search results dropdown */}
              {!selectedUser && searchResults.length > 0 && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left px-3 py-2 transition-colors hover:opacity-80"
                      style={{ background: "var(--surface)" }}
                      onClick={() => {
                        setSelectedUser(r);
                        setSearchResults([]);
                      }}
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

              {/* Ownership % */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Ownership %</label>
                <input
                  className="input-tonal"
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  placeholder="e.g. 50"
                  value={ownershipPct}
                  onChange={(e) => setOwnershipPct(e.target.value)}
                />
              </div>

              <button
                className="btn-primary-gradient w-full justify-center"
                disabled={!selectedUser || !ownershipPct || saving}
                onClick={addCoOwner}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Invite
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
