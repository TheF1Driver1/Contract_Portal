"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Briefcase, Check, X, Loader2 } from "lucide-react";
import type { BusinessGroupMember } from "@/lib/types";

export default function GroupInvites({ invites }: { invites: BusinessGroupMember[] }) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const supabase = createClient();

  async function respond(id: string, accept: boolean) {
    setLoading((p) => ({ ...p, [id]: true }));
    await supabase
      .from("business_group_members")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", id);
    setLoading((p) => ({ ...p, [id]: false }));
    router.refresh();
  }

  if (!invites.length) return null;

  return (
    <div
      className="surface-card p-6 animate-slide-up"
      style={{ animationDelay: "0.20s", animationFillMode: "both" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Briefcase className="h-4 w-4" style={{ color: "#f59e0b" }} strokeWidth={2} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Group Invites
        </h2>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          {invites.length}
        </span>
      </div>

      <div className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-xl p-3"
            style={{ background: "var(--surface-container)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {(inv.group as any)?.name ?? "Unknown Group"}
              </p>
              <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--text-muted)" }}>
                Invited as {inv.role}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button
                onClick={() => respond(inv.id, false)}
                disabled={loading[inv.id]}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{ background: "rgba(255,59,48,0.10)" }}
                title="Decline"
              >
                {loading[inv.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <X className="h-3.5 w-3.5" style={{ color: "#ff3b30" }} />
                )}
              </button>
              <button
                onClick={() => respond(inv.id, true)}
                disabled={loading[inv.id]}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{ background: "rgba(34,197,94,0.10)" }}
                title="Accept"
              >
                {loading[inv.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <Check className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
