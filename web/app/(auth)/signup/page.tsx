"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Home, Loader2, Check, X } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Live username availability
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username) { setUsernameStatus("idle"); return; }

    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!valid) { setUsernameStatus("invalid"); return; }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc("is_username_taken", { uname: username });
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
  }, [username, supabase]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (usernameStatus !== "available") return;
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username: username.toLowerCase() } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const lbl = "block text-xs font-semibold uppercase tracking-widest";
  const lblStyle = { color: "var(--text-muted)" };

  const usernameHint = () => {
    if (usernameStatus === "invalid") return { text: "3–20 chars, letters/numbers/underscores only", color: "#f59e0b" };
    if (usernameStatus === "checking") return { text: "Checking…", color: "var(--text-muted)" };
    if (usernameStatus === "taken") return { text: "Username taken", color: "#ff3b30" };
    if (usernameStatus === "available") return { text: "Available", color: "#22c55e" };
    return null;
  };

  const hint = usernameHint();

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo + headline */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #005bc2, #007aff)" }}
          >
            <Home className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
            >
              ContractOS
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Create your landlord account
            </p>
          </div>
        </div>

        <div className="surface-card space-y-4">
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className={lbl} style={lblStyle}>Full Name</label>
              <input
                id="name"
                className="input-tonal w-full"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className={lbl} style={lblStyle}>Username</label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none"
                  style={{ color: "var(--text-muted)" }}
                >
                  @
                </span>
                <input
                  id="username"
                  className="input-tonal w-full pl-7 pr-8"
                  placeholder="janesmithrealty"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  required
                  autoComplete="username"
                  maxLength={20}
                />
                {usernameStatus === "checking" && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
                )}
                {usernameStatus === "available" && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#22c55e" }} />
                )}
                {usernameStatus === "taken" && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#ff3b30" }} />
                )}
              </div>
              {hint && (
                <p className="text-[11px]" style={{ color: hint.color }}>{hint.text}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className={lbl} style={lblStyle}>Email</label>
              <input
                id="email"
                type="email"
                className="input-tonal w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className={lbl} style={lblStyle}>Password</label>
              <input
                id="password"
                type="password"
                className="input-tonal w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p
                className="rounded-xl px-3 py-2 text-sm"
                style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary-gradient w-full justify-center disabled:opacity-60"
              disabled={loading || usernameStatus !== "available"}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "var(--accent)" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
