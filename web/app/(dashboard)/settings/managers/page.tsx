"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Users, Plus, Trash2, Mail, Clock, CheckCircle2, XCircle, Loader2, Lock } from "lucide-react";
import type { PropertyManager, SubscriptionPlan } from "@/lib/types";
import { canInviteManager, getMaxManagers } from "@/lib/subscription";
import Link from "next/link";

const S = {
  bg:     "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text:   "rgba(200,210,230,0.80)",
  muted:  "rgba(200,210,230,0.45)",
  accent: "#007aff",
};

const STATUS_STYLES: Record<PropertyManager["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  color: "#f59e0b", icon: <Clock size={12} /> },
  accepted: { label: "Active",   color: "#30d158", icon: <CheckCircle2 size={12} /> },
  declined: { label: "Declined", color: "#ff453a", icon: <XCircle size={12} /> },
  revoked:  { label: "Revoked",  color: "#8a9ab8", icon: <XCircle size={12} /> },
};

export default function ManagersSettingsPage() {
  const [managers, setManagers] = useState<PropertyManager[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [perms, setPerms] = useState({ view: true, create_contracts: true, sign_contracts: false });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const [mgRes, propRes, profRes] = await Promise.all([
        fetch("/api/managers"),
        supabase.from("properties").select("id, name").eq("owner_id", user!.id),
        supabase.from("profiles").select("plan").eq("id", user!.id).single(),
      ]);
      setManagers(mgRes.ok ? await mgRes.json() : []);
      setProperties(propRes.data ?? []);
      setPlan((profRes.data?.plan ?? "free") as SubscriptionPlan);
    } finally {
      setLoading(false);
    }
  }

  const activeCount = managers.filter(m => ["pending", "accepted"].includes(m.status)).length;
  const maxManagers = getMaxManagers(plan);
  const canInvite = canInviteManager(plan, activeCount);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || selectedProps.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_email: email, property_ids: selectedProps, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
      setSuccess(`Invite sent to ${email}`);
      setEmail("");
      setSelectedProps([]);
      setPerms({ view: true, create_contracts: true, sign_contracts: false });
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/managers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke");
      setManagers(prev => prev.map(m => m.id === id ? { ...m, status: "revoked" } : m));
    } finally {
      setRevoking(null);
    }
  }

  function toggleProp(id: string) {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  const activeManagers = managers.filter(m => m.status !== "revoked" && m.status !== "declined");
  const pastManagers   = managers.filter(m => m.status === "revoked" || m.status === "declined");

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: S.muted }}>
          Settings
        </p>
        <h1
          className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
          style={{ letterSpacing: "-0.03em" }}
        >
          Property Managers
        </h1>
        <p className="text-sm mt-2" style={{ color: S.muted }}>
          Invite team members to manage contracts and properties on your behalf.
        </p>
      </div>

      {/* Plan gate */}
      {maxManagers === 0 && (
        <div
          className="rounded-2xl p-6 flex items-start gap-4 animate-slide-up"
          style={{ background: "rgba(0,122,255,0.06)", border: "1px solid rgba(0,122,255,0.18)" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(0,122,255,0.15)" }}>
            <Lock size={18} style={{ color: S.accent }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white text-sm mb-1">Inversionista plan required</p>
            <p className="text-xs mb-3" style={{ color: S.muted }}>
              Property manager invites are available on the Inversionista plan (up to 3 managers) and Enterprise (unlimited).
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ background: S.accent, color: "#fff" }}
            >
              Upgrade plan
            </Link>
          </div>
        </div>
      )}

      {/* Invite form */}
      {maxManagers > 0 && (
        <form
          onSubmit={handleInvite}
          className="rounded-2xl p-6 space-y-5 animate-slide-up"
          style={{ background: S.bg, border: `1px solid ${S.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus size={16} style={{ color: S.accent }} />
              <span className="text-sm font-semibold text-white">Invite a Manager</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: S.muted }}>
              {activeCount} / {maxManagers === Infinity ? "∞" : maxManagers} used
            </span>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: S.muted }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="manager@example.com"
              required
              disabled={!canInvite}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${S.border}`,
                color: "#fff",
                opacity: canInvite ? 1 : 0.5,
              }}
            />
          </div>

          {/* Properties */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: S.muted }}>
              Properties to grant access to
            </label>
            {properties.length === 0 ? (
              <p className="text-xs" style={{ color: S.muted }}>No properties found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {properties.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProp(p.id)}
                    disabled={!canInvite}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: selectedProps.includes(p.id) ? "rgba(0,122,255,0.20)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${selectedProps.includes(p.id) ? "rgba(0,122,255,0.35)" : "transparent"}`,
                      color: selectedProps.includes(p.id) ? "#fff" : S.text,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: S.muted }}>Permissions</label>
            <div className="space-y-2">
              {(["view", "create_contracts", "sign_contracts"] as const).map(key => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={perms[key]}
                    onChange={e => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                    disabled={key === "view" || !canInvite}
                    className="accent-blue-500 h-4 w-4"
                  />
                  <span className="text-sm" style={{ color: S.text }}>
                    {key === "view" && "View properties & contracts"}
                    {key === "create_contracts" && "Create & edit contracts"}
                    {key === "sign_contracts" && "Sign contracts on your behalf"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(255,69,58,0.10)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.20)" }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(48,209,88,0.10)", color: "#30d158", border: "1px solid rgba(48,209,88,0.20)" }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !canInvite || !email || selectedProps.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: S.accent, color: "#fff", boxShadow: "0 4px 16px rgba(0,122,255,0.30)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {saving ? "Sending…" : "Send Invite"}
          </button>
        </form>
      )}

      {/* Active managers list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: S.muted }} />
        </div>
      ) : activeManagers.length > 0 ? (
        <div className="space-y-3 animate-slide-up">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Active & Pending</p>
          {activeManagers.map(m => {
            const s = STATUS_STYLES[m.status];
            return (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3"
                style={{ background: S.bg, border: `1px solid ${S.border}` }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "rgba(0,122,255,0.20)" }}>
                  <Users size={14} style={{ color: S.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.manager_email}</p>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                    {m.property_ids.length} propert{m.property_ids.length === 1 ? "y" : "ies"}
                  </p>
                </div>
                <span
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${s.color}18`, color: s.color }}
                >
                  {s.icon}
                  {s.label}
                </span>
                <button
                  onClick={() => handleRevoke(m.id)}
                  disabled={revoking === m.id}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:opacity-50"
                  style={{ background: "rgba(255,69,58,0.10)", color: "#ff453a" }}
                  title="Revoke access"
                >
                  {revoking === m.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            );
          })}
        </div>
      ) : maxManagers > 0 ? (
        <div
          className="rounded-2xl p-8 text-center animate-slide-up"
          style={{ background: S.bg, border: `1px solid ${S.border}` }}
        >
          <Users size={24} className="mx-auto mb-3" style={{ color: S.muted }} />
          <p className="text-sm font-medium text-white mb-1">No managers yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Invite a manager above to grant access to your properties.</p>
        </div>
      ) : null}

      {/* Past (revoked/declined) */}
      {pastManagers.length > 0 && (
        <div className="space-y-2 animate-slide-up">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Revoked / Declined</p>
          {pastManagers.map(m => {
            const s = STATUS_STYLES[m.status];
            return (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3 opacity-50"
                style={{ background: S.bg, border: `1px solid ${S.border}` }}
              >
                <Users size={14} style={{ color: S.muted }} />
                <p className="text-sm flex-1 truncate" style={{ color: S.muted }}>{m.manager_email}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${s.color}18`, color: s.color }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
