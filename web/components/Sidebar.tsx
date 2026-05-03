"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Building2,
  Users,
  LogOut,
  Home,
  Menu,
  Map,
  Heart,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/contracts",  label: "Contracts",   icon: FileText },
  { href: "/properties", label: "Properties",  icon: Building2 },
  { href: "/tenants",    label: "Tenants",     icon: Users },
  { href: "/market",     label: "Market",      icon: Map },
  { href: "/watchlist",  label: "Watchlist",   icon: Heart },
];

const mobileNavItems = navItems.slice(0, 5);

interface SidebarProps {
  userEmail: string;
}

const S = {
  bg:          "#000000",
  border:      "rgba(255,255,255,0.06)",
  activeBg:    "rgba(0,122,255,0.18)",
  activeGlow:  "0 0 18px rgba(0,122,255,0.25), 0 2px 8px rgba(0,122,255,0.12)",
  activeBorder:"rgba(0,122,255,0.30)",
  hoverBg:     "rgba(255,255,255,0.05)",
  text:        "rgba(200,210,230,0.70)",
  textActive:  "#ffffff",
  textMuted:   "rgba(120,135,160,0.50)",
  divider:     "rgba(255,255,255,0.06)",
  footerBg:    "rgba(255,255,255,0.03)",
  avatarGrad:  "linear-gradient(135deg, #0057d9, #007aff)",
};

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const initials = userEmail ? userEmail[0].toUpperCase() : "?";

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 justify-between"
        style={{
          background: "rgba(10,15,28,0.88)",
          backdropFilter: "blur(24px)",
          borderBottom: `1px solid ${S.border}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, #0057d9, #007aff)" }}
          >
            <Home className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#fff" }}>
            ContractOS
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: S.hoverBg }}
          aria-label="Open menu"
        >
          <Menu size={18} style={{ color: S.text }} />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-72 h-full flex flex-col animate-slide-in-left"
            style={{
              background: S.bg,
              borderRight: `1px solid ${S.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${S.divider}` }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #0057d9, #007aff)" }}
                >
                  <Home className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold" style={{ color: "#fff" }}>ContractOS</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: S.hoverBg }}
                aria-label="Close menu"
              >
                <X size={16} style={{ color: S.text }} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 p-3 flex-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
                    style={{
                      background: active ? S.activeBg : "transparent",
                      color: active ? S.textActive : S.text,
                      boxShadow: active ? S.activeGlow : "none",
                      border: `1px solid ${active ? S.activeBorder : "transparent"}`,
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3" style={{ borderTop: `1px solid ${S.divider}` }}>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
                style={{ color: S.text, background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = S.hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around py-2 px-2"
        style={{
          background: "rgba(10,15,28,0.90)",
          backdropFilter: "blur(24px)",
          borderTop: `1px solid ${S.border}`,
        }}
      >
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200"
              style={{ color: active ? "#007aff" : S.text }}
            >
              <Icon
                size={20}
                style={{ transform: active ? "scale(1.1)" : "scale(1)", transition: "transform 200ms ease" }}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex h-screen w-64 flex-col relative overflow-hidden animate-slide-in-left"
        style={{
          background: S.bg,
          borderRight: `1px solid ${S.border}`,
        }}
      >
        {/* Subtle inner glow at top */}
        <div
          className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 30% -10%, rgba(0,122,255,0.08) 0%, transparent 65%)",
          }}
        />

        {/* Logo */}
        <div
          className="relative flex h-16 items-center gap-3 px-5"
          style={{ borderBottom: `1px solid ${S.divider}` }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #0057d9 0%, #007aff 100%)",
              boxShadow: "0 4px 16px rgba(0,122,255,0.40), 0 1px 0 rgba(255,255,255,0.2) inset",
            }}
          >
            <Home className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[15px] font-bold tracking-tight leading-none" style={{ color: "#fff" }}>
              ContractOS
            </span>
            <p className="text-[10px] mt-0.5 font-medium uppercase tracking-widest" style={{ color: S.textMuted }}>
              Portfolio
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="relative flex flex-1 flex-col gap-0.5 p-3 pt-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
            style={{ color: S.textMuted }}
          >
            Navigation
          </p>
          {navItems.map(({ href, label, icon: Icon }, i) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium animate-slide-up"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  animationFillMode: "both",
                  background: active ? S.activeBg : "transparent",
                  color: active ? S.textActive : S.text,
                  boxShadow: active ? S.activeGlow : "none",
                  border: `1px solid ${active ? S.activeBorder : "transparent"}`,
                  transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = S.hoverBg;
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Active accent left bar */}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 3, height: 20, background: "#007aff", boxShadow: "0 0 8px rgba(0,122,255,0.7)" }}
                  />
                )}
                <Icon
                  className="h-[17px] w-[17px] shrink-0"
                  strokeWidth={active ? 2.5 : 2}
                  style={{ color: active ? "#007aff" : S.text }}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="relative p-3 space-y-1"
          style={{ borderTop: `1px solid ${S.divider}` }}
        >
          {/* User row */}
          <div
            className="flex items-center gap-3 rounded-xl p-2.5"
            style={{ background: S.footerBg, border: `1px solid ${S.divider}` }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: S.avatarGrad, boxShadow: "0 2px 8px rgba(0,122,255,0.35)" }}
            >
              {initials}
            </div>
            <p className="flex-1 min-w-0 truncate text-xs font-medium" style={{ color: S.text }}>
              {userEmail}
            </p>
            <button
              onClick={signOut}
              title="Sign out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.background = S.hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" style={{ color: S.textMuted }} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
