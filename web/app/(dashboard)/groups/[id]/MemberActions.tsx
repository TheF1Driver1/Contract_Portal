"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Shield, User, UserMinus, Loader2 } from "lucide-react";

interface Props {
  memberId: string;
  currentRole: "owner" | "admin" | "member";
  groupId: string;
}

export default function MemberActions({ memberId, currentRole, groupId }: Props) {
  const [loading, setLoading] = useState<"promote" | "demote" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function changeRole(newRole: "admin" | "member") {
    setLoading(newRole === "admin" ? "promote" : "demote");
    await supabase
      .from("business_group_members")
      .update({ role: newRole })
      .eq("id", memberId);
    setLoading(null);
    router.refresh();
  }

  async function removeMember() {
    setLoading("remove");
    await supabase.from("business_group_members").delete().eq("id", memberId);
    setLoading(null);
    router.refresh();
  }

  if (confirmRemove) {
    return (
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        <button
          onClick={() => setConfirmRemove(false)}
          className="text-[10px] font-medium px-2 py-1 rounded-lg"
          style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
        >
          Cancel
        </button>
        <button
          onClick={removeMember}
          disabled={!!loading}
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
        >
          {loading === "remove" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 ml-3 shrink-0">
      {currentRole !== "owner" && (
        <>
          {currentRole === "member" ? (
            <button
              onClick={() => changeRole("admin")}
              disabled={!!loading}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: "rgba(0,122,255,0.10)", color: "#007aff" }}
              title="Make Admin"
            >
              {loading === "promote" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              Make Admin
            </button>
          ) : (
            <button
              onClick={() => changeRole("member")}
              disabled={!!loading}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
              title="Demote to Member"
            >
              {loading === "demote" ? <Loader2 className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />}
              Demote
            </button>
          )}
        </>
      )}
      <button
        onClick={() => setConfirmRemove(true)}
        disabled={!!loading}
        className="flex h-6 w-6 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
        style={{ background: "rgba(239,68,68,0.08)" }}
        title="Remove from group"
      >
        <UserMinus className="h-3 w-3" style={{ color: "#ef4444" }} />
      </button>
    </div>
  );
}
