"use client";

import { useState } from "react";
import { BarChart3, Lock, Download, Check, ArrowUpRight, FileText, Zap } from "lucide-react";
import Link from "next/link";
import type { SubscriptionPlan } from "@/lib/types";

const S = {
  bg:     "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text:   "rgba(200,210,230,0.80)",
  muted:  "rgba(200,210,230,0.45)",
};

const INVERSIONISTA_FEATURES = [
  "Schedule E PDF mapped to correct IRS line numbers",
  "Income & expenses broken down per property",
  "Unlimited properties",
  "Act 60 portfolio panel",
  "Up to 3 property managers",
  "Priority support (48h SLA)",
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function ScheduleEClient({
  plan,
  canExport,
}: {
  plan: SubscriptionPlan;
  canExport: boolean;
}) {
  const [year, setYear] = useState(currentYear);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/schedule-e?year=${year}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate report");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-e-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDownloading(false);
    }
  }

  // ── Upgrade gate ──────────────────────────────────────────────────────────
  if (!canExport) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="animate-slide-up">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Reports
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Schedule E
          </h1>
        </div>

        {/* Gate card */}
        <div
          className="rounded-2xl p-8 flex flex-col items-center text-center animate-slide-up"
          style={{
            background: "rgba(0,122,255,0.06)",
            border: "1px solid rgba(0,122,255,0.18)",
            animationDelay: "0.06s",
            animationFillMode: "both",
          }}
        >
          {/* Icon + lock badge */}
          <div className="relative mb-6">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{
                background: "linear-gradient(135deg, rgba(0,87,217,0.25), rgba(0,122,255,0.15))",
                border: "1px solid rgba(0,122,255,0.25)",
                boxShadow: "0 8px 32px rgba(0,122,255,0.15)",
              }}
            >
              <BarChart3 className="h-9 w-9" style={{ color: "#007aff" }} strokeWidth={1.5} />
            </div>
            <div
              className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: "rgba(255,69,58,0.18)",
                border: "1px solid rgba(255,69,58,0.35)",
              }}
            >
              <Lock className="h-3.5 w-3.5" style={{ color: "#ff453a" }} strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">IRS Schedule E Report</h2>
          <p className="text-sm max-w-sm mb-8" style={{ color: S.muted }}>
            Generate a pre-filled Schedule E PDF for your rental properties —
            with income and expenses mapped to the correct IRS line items.
          </p>

          {/* Feature list */}
          <ul className="space-y-2.5 mb-8 text-left w-full max-w-xs">
            {INVERSIONISTA_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: S.text }}>
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(0,122,255,0.15)" }}
                >
                  <Check size={11} style={{ color: "#007aff" }} strokeWidth={3} />
                </div>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "#007aff",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(0,122,255,0.40)",
            }}
          >
            <Zap size={15} />
            Upgrade to Inversionista
            <ArrowUpRight size={14} />
          </Link>
          <p className="text-xs mt-3" style={{ color: S.muted }}>
            $99/mes &middot; Cancel anytime
          </p>
        </div>

        {/* What is Schedule E */}
        <div
          className="rounded-2xl p-5 animate-slide-up"
          style={{
            background: S.bg,
            border: `1px solid ${S.border}`,
            animationDelay: "0.12s",
            animationFillMode: "both",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <FileText size={15} style={{ color: S.muted }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">What is Schedule E?</p>
              <p className="text-xs leading-relaxed" style={{ color: S.muted }}>
                Schedule E is an IRS form used by rental property owners to report income,
                expenses, and net profit or loss. ContractOS maps your tracked expenses
                directly to the correct line numbers and generates a PDF you can hand to
                your accountant or use as a reference when filing.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div
        className="flex items-start justify-between gap-4 flex-wrap animate-slide-up"
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Reports
          </p>
          <h1
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
            style={{ letterSpacing: "-0.03em" }}
          >
            Schedule E
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            IRS Supplemental Income &amp; Loss &mdash; for informational purposes only
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: "#007aff",
            color: "#fff",
            boxShadow: downloading ? "none" : "0 4px 16px rgba(0,122,255,0.35)",
          }}
        >
          {downloading ? (
            <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Download size={15} />
          )}
          {downloading ? "Generating…" : `Download ${year} PDF`}
        </button>
      </div>

      {/* Year selector */}
      <div
        className="flex flex-wrap gap-2 animate-slide-up"
        style={{ animationDelay: "0.06s", animationFillMode: "both" }}
      >
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: y === year ? "rgba(0,122,255,0.18)" : "rgba(255,255,255,0.06)",
              color: y === year ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${y === year ? "rgba(0,122,255,0.30)" : "transparent"}`,
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm animate-fade-in"
          style={{
            background: "rgba(255,69,58,0.10)",
            border: "1px solid rgba(255,69,58,0.25)",
            color: "#ff453a",
          }}
        >
          {error}
        </div>
      )}

      {/* Info card */}
      <div
        className="rounded-2xl p-5 animate-slide-up"
        style={{
          background: S.bg,
          border: `1px solid ${S.border}`,
          animationDelay: "0.10s",
          animationFillMode: "both",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <FileText size={15} style={{ color: S.muted }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">What&apos;s included</p>
            <p className="text-xs leading-relaxed" style={{ color: S.muted }}>
              Your report includes rental income from signed contracts and all tracked expenses
              mapped to their correct IRS Schedule E line numbers. Share with your accountant
              or use as a filing reference. This report is not tax advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
