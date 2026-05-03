"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Loader2, ArrowRight } from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { SplineScene } from "@/components/ui/splite";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

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
    <main className="min-h-screen w-full relative overflow-hidden">
      {/* Background layers */}
      <MeshGradientBg />
      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="absolute inset-0 w-full h-full"
      />

      {/* Cursor spotlight */}
      <Spotlight size={150} springOptions={{ stiffness: 60, damping: 20, mass: 1 }} />

      {/* Foreground — form floats right */}
      <div className="pointer-events-none relative z-10 flex items-center justify-end h-screen">
        <div className="pointer-events-none w-1/2 flex flex-col justify-center px-10 lg:px-16">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="pointer-events-auto space-y-5">
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-400 placeholder-neutral-600 outline-none focus:border-white/30 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
                  htmlFor="password"
                >
                  Password
                </label>
                <span className="text-xs text-neutral-400 cursor-pointer hover:text-white transition-colors">
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-400 placeholder-neutral-600 outline-none focus:border-white/30 transition-colors"
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
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="pointer-events-auto mt-6 text-center text-sm text-neutral-600">
            No account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
