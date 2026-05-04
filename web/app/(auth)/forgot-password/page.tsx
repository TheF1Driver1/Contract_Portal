"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full relative overflow-hidden">
      {/* Background layers */}
      <MeshGradientBg />
      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="absolute inset-0 w-full h-full"
      />

      {/* Foreground — hero left + form right */}
      <div className="pointer-events-none relative z-10 flex items-center h-screen">
        {/* Left hero text */}
        <div className="hidden md:flex w-1/2 flex-col justify-center px-12 lg:px-20 gap-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Real Estate Management
          </p>
          <h2 className="text-5xl lg:text-6xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            Reset your<br />password.<br />Easy.
          </h2>
          <p className="text-neutral-500 text-base leading-relaxed max-w-sm">
            We&apos;ll send you a secure link to set a new password. Check your inbox.
          </p>
        </div>

        {/* Right form */}
        <div className="pointer-events-none w-full md:w-1/2 flex flex-col justify-center px-10 lg:px-16">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              No worry. Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {success ? (
            <div className="pointer-events-auto space-y-5">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                Reset link sent to <strong>{email}</strong>. Check your inbox.
              </div>
              <button
                type="button"
                onClick={() => { setSuccess(false); setEmail(""); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/10 border border-neutral-200/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
              <p className="mt-6 text-center text-sm text-neutral-600">
                Remembered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-neutral-300 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pointer-events-auto space-y-5">
              <div className="space-y-1.5">
                <label
                  className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
                  htmlFor="reset-email"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-black placeholder-neutral-400 outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-100 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <p className="mt-6 text-center text-sm text-neutral-600">
                Remembered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-neutral-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3 w-3 inline mr-1" />
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
