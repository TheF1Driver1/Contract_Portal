"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AtSign, Loader2, Check, X } from "lucide-react";

export default function UsernameSetupModal() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username) { setStatus("idle"); return; }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setStatus("invalid"); return; }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc("is_username_taken", { uname: username });
      setStatus(data ? "taken" : "available");
    }, 400);
  }, [username, supabase]);

  async function save() {
    if (status !== "available") return;
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: err } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", user.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  const hint = () => {
    if (status === "invalid")   return { text: "3–20 chars, letters/numbers/underscores only", color: "#f59e0b" };
    if (status === "checking")  return { text: "Checking…", color: "var(--text-muted)" };
    if (status === "taken")     return { text: "Username taken", color: "#ff3b30" };
    if (status === "available") return { text: "Available!", color: "#22c55e" };
    return null;
  };
  const h = hint();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
    >
      <div className="surface-card w-full max-w-sm p-6 space-y-5 animate-slide-up">
        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "rgba(0,122,255,0.12)" }}
          >
            <AtSign className="h-6 w-6" style={{ color: "#007aff" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Choose a username
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Required so partners can find and invite you to groups.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none"
              style={{ color: "var(--text-muted)" }}
            >
              @
            </span>
            <input
              className="input-tonal w-full pl-7 pr-8"
              placeholder="yourhandle"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              maxLength={20}
              autoFocus
            />
            {status === "checking" && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
            )}
            {status === "available" && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#22c55e" }} />
            )}
            {status === "taken" && (
              <X className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#ff3b30" }} />
            )}
          </div>
          {h && <p className="text-[11px]" style={{ color: h.color }}>{h.text}</p>}
          {error && <p className="text-[11px]" style={{ color: "#ff3b30" }}>{error}</p>}
        </div>

        <button
          className="btn-primary-gradient w-full justify-center disabled:opacity-50"
          disabled={status !== "available" || saving}
          onClick={save}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Set Username
        </button>
      </div>
    </div>,
    document.body
  );
}
