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

  const navLinks = navItems.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        pathname === href || pathname.startsWith(href + "/")
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  ));

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b bg-card flex items-center px-4 justify-between">
        <span className="font-bold">ContractOS</span>
        <button onClick={() => setOpen(true)}><Menu size={22} /></button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-64 h-full bg-card p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-1 flex-col gap-1 pt-2">
              {navLinks}
            </nav>
            <div className="border-t pt-4">
              <div className="mb-2 flex justify-end">
                <ThemeToggle />
              </div>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card flex justify-around py-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg",
              pathname === href || pathname.startsWith(href + "/")
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ContractOS</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navLinks}
        </nav>

        {/* Sign out */}
        <div className="border-t p-4">
          <div className="mb-2 flex justify-end">
            <ThemeToggle />
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
