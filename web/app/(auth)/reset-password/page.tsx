"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsRecovery(params.get("type") === "recover");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
     } else {
      router.push("/login");
      router.refresh();
     }
  }

  if (!isRecovery) {
    return (
      <main className="min-h-screen w-full relative overflow-hidden">
        <MeshGradientBg />
        <SplineScene
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="absolute inset-0 w-full h-full"
        />
        <div className="pointer-events-none relative z-10 flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Invalid link
            </h1>
            <p className="text-sm text-neutral-500">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Try again
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full relative overflow-hidden">
      <MeshGradientBg />
      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="absolute inset-0 w-full h-full"
      />

      <div className="pointer-events-none relative z-10 flex items-center h-screen">
        {/* Left hero text */}
        <div className="hidden md:flex w-1/2 flex-col justify-center px-12 lg:px-20 gap-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Real Estate Management
          </p>
          <h2 className="text-5xl lg:text-6xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            New<br />password.
          </h2>
          <p className="text-neutral-500 text-base leading-relaxed max-w-sm">
            Set a strong password you&apos;ll actually remember.
          </p>
        </div>

        {/* Right form */}
        <div className="pointer-events-none w-full md:w-1/2 flex flex-col justify-center px-10 lg:px-16">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Reset password
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="pointer-events-auto space-y-5">
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
                htmlFor="new-password"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-black placeholder-neutral-400 outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-100 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
                htmlFor="confirm-password"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
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
                "Update Password"
              )}
            </button>
          </form>

          <p className="pointer-events-auto mt-6 text-center text-sm text-neutral-600">
            Back?{" "}
            <Link
              href="/login"
              className="font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3 inline mr-1" />
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
