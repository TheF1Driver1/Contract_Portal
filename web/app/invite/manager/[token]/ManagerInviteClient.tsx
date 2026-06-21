"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, XCircle, Loader2, Users } from "lucide-react";

interface Props {
  token: string;
  managerEmail: string;
  ownerName: string;
  properties: { id: string; name: string; address: string }[];
}

export default function ManagerInviteClient({ token, managerEmail, ownerName, properties }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/managers/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/invite/manager/${token}`);
          return;
        }
        throw new Error(data.error ?? "Something went wrong");
      }
      setDone(action === "accept" ? "accepted" : "declined");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  if (done === "accepted") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">Invitation Accepted</h1>
        <p className="mt-2 text-sm text-neutral-400">
          You now have access to manage properties for {ownerName}.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-500/10">
          <XCircle className="h-6 w-6 text-neutral-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">Invitation Declined</h1>
        <p className="mt-2 text-sm text-neutral-400">
          You&apos;ve declined this invitation. Contact {ownerName} if this was a mistake.
        </p>
        <a href="/" className="mt-6 inline-block text-sm text-neutral-500 hover:text-white transition-colors">
          Go to homepage
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f1c] p-8 backdrop-blur-sm shadow-2xl">
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6" style={{ background: "rgba(0,122,255,0.15)", border: "1px solid rgba(0,122,255,0.25)" }}>
        <Users className="h-7 w-7" style={{ color: "#007aff" }} />
      </div>

      <h1 className="text-xl font-bold text-white mb-1">Property Manager Invitation</h1>
      <p className="text-sm text-neutral-400 mb-6">
        <span className="text-white font-medium">{ownerName}</span> has invited{" "}
        <span className="text-white font-medium">{managerEmail}</span> to manage the following properties:
      </p>

      {/* Properties */}
      <div className="space-y-2 mb-6">
        {properties.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Building2 size={14} style={{ color: "#007aff" }} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{p.name}</p>
              <p className="text-xs text-neutral-500 truncate">{p.address}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-xs rounded-xl px-3 py-2 mb-4" style={{ background: "rgba(255,69,58,0.10)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.20)" }}>
          {error}
        </p>
      )}

      <p className="text-xs text-neutral-500 mb-5">
        You must be logged in as <span className="text-neutral-300">{managerEmail}</span> to accept this invite.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => handleAction("accept")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: "#007aff", color: "#fff", boxShadow: "0 4px 16px rgba(0,122,255,0.30)" }}
        >
          {loading === "accept" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Accept
        </button>
        <button
          onClick={() => handleAction("decline")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.06)", color: "#8a9ab8", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {loading === "decline" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Decline
        </button>
      </div>
    </div>
  );
}
