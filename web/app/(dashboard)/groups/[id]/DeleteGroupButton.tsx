"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function deleteGroup() {
    setLoading(true);
    await supabase.from("business_groups").delete().eq("id", groupId);
    router.push("/groups");
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Delete group?</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium px-2.5 py-1 rounded-lg"
          style={{ background: "var(--surface-container)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button
          onClick={deleteGroup}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Confirm
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
      style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  );
}
