"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Loader2, Mail, Lock, Phone, CheckCircle2, AlertCircle, User } from "lucide-react";

const S = {
  card:        "rgba(255,255,255,0.04)",
  border:      "rgba(255,255,255,0.07)",
  input:       "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.10)",
  inputFocus:  "rgba(0,122,255,0.40)",
  text:        "rgba(200,210,230,0.85)",
  muted:       "rgba(120,135,160,0.60)",
  accent:      "#007aff",
  accentHover: "#0066dd",
  label:       "rgba(150,165,190,0.55)",
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,122,255,0.14)", border: `1px solid rgba(0,122,255,0.22)` }}
        >
          <Icon className="h-4 w-4" style={{ color: S.accent }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</h2>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function StatusBanner({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
      style={{
        background: type === "success" ? "rgba(52,199,89,0.10)" : "rgba(255,69,58,0.10)",
        border: `1px solid ${type === "success" ? "rgba(52,199,89,0.25)" : "rgba(255,69,58,0.25)"}`,
        color: type === "success" ? "#34c759" : "#ff453a",
      }}
    >
      {type === "success"
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}

function StyledInput({
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
      style={{
        background: S.input,
        border: `1px solid ${S.inputBorder}`,
        color: S.text,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = S.inputFocus)}
      onBlur={(e) => (e.currentTarget.style.borderColor = S.inputBorder)}
    />
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
      style={{ color: S.label }}
    >
      {children}
    </label>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: S.accent, color: "#fff" }}
      onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = S.accentHover; }}
      onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = S.accent; }}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
}

export default function ProfilePage() {
  const supabase = createClient();

  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail]         = useState("");
  const [emailStatus, setEmailStatus]   = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [resetStatus, setResetStatus]   = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [phone, setPhone]               = useState("");
  const [phoneStatus, setPhoneStatus]   = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setCurrentEmail(data.user.email ?? "");
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.phone) setPhone(formatPhone(profile.phone));
        });
    });
  }, []);

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === currentEmail) return;
    setEmailLoading(true);
    setEmailStatus(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setEmailStatus({ type: "error", message: error.message });
    } else {
      setEmailStatus({ type: "success", message: "Confirmation sent to both addresses. Check your inbox." });
      setCurrentEmail(newEmail.trim());
      setNewEmail("");
    }
    setEmailLoading(false);
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetStatus(null);
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setResetStatus({ type: "error", message: error.message });
    } else {
      setResetStatus({ type: "success", message: `Reset link sent to ${currentEmail}.` });
    }
    setResetLoading(false);
  }

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handlePhoneUpdate(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneStatus({ type: "error", message: "Enter a 10-digit phone number." });
      return;
    }
    setPhoneLoading(true);
    setPhoneStatus(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhoneLoading(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ phone: formatPhone(digits) })
      .eq("id", user.id);
    if (error) {
      setPhoneStatus({ type: "error", message: error.message });
    } else {
      setPhoneStatus({ type: "success", message: "Phone number saved." });
    }
    setPhoneLoading(false);
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: "rgba(0,122,255,0.14)", border: "1px solid rgba(0,122,255,0.22)" }}
        >
          <User className="h-5 w-5" style={{ color: S.accent }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#fff" }}>Profile</h1>
          <p className="text-sm" style={{ color: S.muted }}>{currentEmail}</p>
        </div>
      </div>

      {/* Email */}
      <SectionCard icon={Mail} title="Email Address" description="Update the email used to sign in.">
        <form onSubmit={handleEmailUpdate} className="space-y-4">
          <div>
            <Label htmlFor="current-email">Current Email</Label>
            <input
              id="current-email"
              type="email"
              value={currentEmail}
              disabled
              readOnly
              className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${S.inputBorder}`,
                color: S.muted,
                cursor: "default",
              }}
            />
          </div>
          <div>
            <Label htmlFor="new-email">New Email</Label>
            <StyledInput
              id="new-email"
              type="email"
              value={newEmail}
              onChange={setNewEmail}
              placeholder="new@example.com"
              autoComplete="email"
            />
          </div>
          {emailStatus && <StatusBanner {...emailStatus} />}
          <SubmitButton loading={emailLoading} label="Update Email" />
        </form>
      </SectionCard>

      {/* Password */}
      <SectionCard icon={Lock} title="Password" description="Send a reset link to your email.">
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <p className="text-xs" style={{ color: S.muted }}>
            A password reset link will be sent to <span style={{ color: S.text }}>{currentEmail}</span>.
          </p>
          {resetStatus && <StatusBanner {...resetStatus} />}
          <SubmitButton loading={resetLoading} label="Send Reset Link" />
        </form>
      </SectionCard>

      {/* Phone */}
      <SectionCard icon={Phone} title="Phone Number" description="Add or update your phone number.">
        <form onSubmit={handlePhoneUpdate} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <StyledInput
              id="phone"
              type="tel"
              value={phone}
              onChange={(v) => setPhone(formatPhone(v))}
              placeholder="123-456-7890"
              autoComplete="tel"
            />
            <p className="text-[11px] mt-1.5" style={{ color: S.muted }}>
              10-digit number, auto-formatted as xxx-xxx-xxxx.
            </p>
          </div>
          {phoneStatus && <StatusBanner {...phoneStatus} />}
          <SubmitButton loading={phoneLoading} label="Save Phone" />
        </form>
      </SectionCard>
    </div>
  );
}
