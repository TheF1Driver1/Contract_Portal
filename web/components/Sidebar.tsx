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
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/market", label: "Market", icon: Map },
  { href: "/watchlist", label: "Watchlist", icon: Heart },
];

export default function Sidebar() {
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

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 glass border-b border-outline-variant/15 flex items-center px-5 justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#005bc2] to-[#007aff]">
            <Home className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#2c333d] dark:text-white">
            ContractOS
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--nav-hover-bg)] dark:hover:bg-white/10"
        >
          <Menu size={18} className="text-[#595f6a]" />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-72 h-full glass border-r border-outline-variant/15 flex flex-col animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#005bc2] to-[#007aff]">
                  <Home className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold tracking-tight text-[#2c333d] dark:text-white">
                  ContractOS
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[var(--nav-hover-bg)] dark:hover:bg-white/10 transition-colors"
              >
                <X size={16} className="text-[#595f6a]" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1 p-3 flex-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                    isActive(href)
                      ? "bg-[#007aff]/10 text-[#007aff] dark:bg-[#007aff]/20"
                      : "text-[#595f6a] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive(href) ? "text-[#007aff]" : ""
                    )}
                  />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-outline-variant/15">
              <div className="mb-2 flex justify-end px-1">
                <ThemeToggle />
              </div>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#595f6a] transition-all duration-300 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-primary)]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-outline-variant/15 flex justify-around py-2 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-300",
              isActive(href)
                ? "text-[#007aff]"
                : "text-[#595f6a]"
            )}
          >
            <Icon
              size={20}
              className={cn(
                "transition-transform duration-300",
                isActive(href) ? "scale-110" : ""
              )}
            />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-outline-variant/15 animate-slide-in-left" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-outline-variant/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#005bc2] to-[#007aff] shadow-ambient">
            <Home className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-[#2c333d] dark:text-white leading-none">
              ContractOS
            </span>
            <p className="text-[10px] text-[#acb2bf] mt-0.5 font-medium uppercase tracking-widest">
              Portfolio
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-3 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#acb2bf] px-3 mb-2">
            Navigation
          </p>
          {navItems.map(({ href, label, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                "animate-slide-up",
                isActive(href)
                  ? "bg-[#007aff]/10 text-[#007aff] dark:bg-[#007aff]/20 dark:text-[#007aff]"
                  : "text-[#595f6a] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-primary)]"
              )}
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}
            >
              {/* Active indicator */}
              {isActive(href) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#007aff] rounded-full" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-all duration-300",
                  isActive(href)
                    ? "text-[#007aff]"
                    : "group-hover:text-[var(--text-primary)] dark:group-hover:text-white"
                )}
                strokeWidth={isActive(href) ? 2.5 : 2}
              />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-outline-variant/10">
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-xs text-[#acb2bf] font-medium">Theme</span>
            <ThemeToggle />
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#595f6a] transition-all duration-300 hover:bg-[var(--nav-hover-bg)] hover:text-[#9f403d] group"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 transition-all duration-300 group-hover:text-[#9f403d] dark:group-hover:text-[#fe8983]" strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
