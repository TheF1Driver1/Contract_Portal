"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, ArrowRight, Building2 } from "lucide-react";

interface Props {
  token: string;
  tenantEmail: string;
  tenantName: string;
  contractId: string;
  propertyName: string;
}

type Tab = "signup" | "signin";

export default function InviteSignupClient({
  token,
  tenantEmail,
  tenantName,
  contractId: _contractId,
  propertyName,
}: Props) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<Tab>("signup");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(tenantName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function redeem() {
    const res = await fetch(`/api/invite/${token}/redeem`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to redeem invite");
    return json.contractId as string;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: tenantEmail,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;

      const cId = await redeem();
      router.push(`/portal/sign/${cId}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tenantEmail,
        password,
      });
      if (signInError) throw signInError;

      const cId = await redeem();
      router.push(`/portal/sign/${cId}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Context card */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
            <Building2 className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Lease Agreement</p>
            <p className="mt-1 text-sm text-white">
              You&apos;ve been invited to sign your lease for{" "}
              <span className="font-semibold">{propertyName}</span>
              {tenantName ? `, ${tenantName}` : ""}.
            </p>
          </div>
        </div>
      </div>

      {/* Auth form */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-white/5 p-1">
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "signup" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(""); }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "signin" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={tab === "signup" ? handleSignup : handleSignin} className="space-y-4">
          {tab === "signup" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-black placeholder-neutral-400 outline-none focus:border-neutral-300 focus:ring-2 focus:ring-neutral-100 transition-colors"
                placeholder="Your full name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Email
            </label>
            <input
              type="email"
              value={tenantEmail}
              readOnly
              className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500 outline-none cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
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
              <>
                {tab === "signup" ? "Create Account & Continue" : "Sign In & Continue"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
