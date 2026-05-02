"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Home, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-base)" }}>
      {/* ── Left: Animated gradient panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animated-gradient">
        {/* Floating blobs */}
        <div
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30 animate-float-blob"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-20 animate-float-blob-slow"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[40%] right-[10%] w-[35%] h-[35%] rounded-full opacity-15 animate-float-blob"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
            animationDelay: "3s",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Home className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">ContractOS</span>
          </div>

          {/* Editorial headline */}
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-medium uppercase tracking-widest">
                Real Estate Management
              </p>
              <h1
                className="text-white text-5xl font-bold leading-[1.1]"
                style={{ letterSpacing: "-0.03em" }}
              >
                Your portfolio.<br />
                Managed<br />
                beautifully.
              </h1>
            </div>
            <p className="text-white/70 text-base leading-relaxed max-w-xs">
              Contracts, tenants, and market intelligence — all in one clean, powerful dashboard.
            </p>

            {/* Stats row */}
            <div className="flex gap-8 pt-4">
              {[
                { value: "100%", label: "Digital" },
                { value: "< 2min", label: "Contract Gen" },
                { value: "0 paper", label: "Paperless" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p
                    className="text-white text-xl font-bold"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {value}
                  </p>
                  <p className="text-white/60 text-xs font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom caption */}
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} ContractOS
          </p>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[380px] animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#005bc2] to-[#007aff]">
              <Home className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight text-[var(--text-primary)] text-[15px]">ContractOS</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-bold text-[var(--text-primary)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Sign in to your account to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-tonal"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
                  htmlFor="password"
                >
                  Password
                </label>
                <span className="text-xs text-[#007aff] font-medium cursor-pointer hover:opacity-70 transition-opacity">
                  Forgot?
                </span>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input-tonal"
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#9f403d]"
                style={{ background: "rgba(159, 64, 61, 0.08)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary-gradient w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={loading ? { transform: "none" } : undefined}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            No account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#007aff] hover:opacity-70 transition-opacity"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
