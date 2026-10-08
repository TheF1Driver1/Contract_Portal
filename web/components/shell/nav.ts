import {
  BarChart3,
  Building2,
  FileText,
  Heart,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon; badge?: "labs" };

export const NAV_GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: "workspace",
    items: [
      { href: "/dashboard", key: "home", icon: LayoutDashboard },
      { href: "/contracts", key: "contracts", icon: FileText },
      { href: "/properties", key: "properties", icon: Building2 },
      { href: "/tenants", key: "tenants", icon: Users },
      { href: "/rent", key: "rent", icon: Wallet },
      { href: "/maintenance", key: "maintenance", icon: Wrench },
      { href: "/expenses", key: "expenses", icon: Receipt },
    ],
  },
  {
    key: "insights",
    items: [
      { href: "/reports", key: "reports", icon: BarChart3 },
      { href: "/market", key: "market", icon: Map, badge: "labs" },
      { href: "/watchlist", key: "watchlist", icon: Heart, badge: "labs" },
    ],
  },
  {
    key: "account",
    items: [{ href: "/settings/billing", key: "settings", icon: Settings }],
  },
];

/** Four primary destinations on the phone tab bar; the rest live under "Más". */
export const MOBILE_TABS = ["/dashboard", "/contracts", "/properties", "/tenants"];

export function isActive(pathname: string, href: string) {
  if (href === "/settings/billing") return pathname.startsWith("/settings") || pathname === "/profile";
  return pathname === href || pathname.startsWith(href + "/");
}
