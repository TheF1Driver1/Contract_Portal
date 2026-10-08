"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, BookText, CreditCard, FileText, UserCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/profile", key: "profile", icon: UserCircle },
  { href: "/settings/billing", key: "billing", icon: CreditCard },
  { href: "/settings/notifications", key: "notifications", icon: Bell },
  { href: "/settings/managers", key: "managers", icon: Users },
  { href: "/settings/templates", key: "templates", icon: FileText },
  { href: "/settings/sections", key: "sections", icon: BookText },
] as const;

/** Settings sub-navigation: underline tabs on desktop, scrollable pills on phone. */
export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-4 mb-6 md:mx-0">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 md:gap-1 md:overflow-visible md:border-b md:border-border md:px-0 md:pb-0">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  "md:-mb-px md:rounded-none md:border-0 md:border-b-2 md:px-3",
                  active
                    ? "border-primary bg-primary-soft text-primary-soft-foreground md:bg-transparent md:text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground md:border-transparent md:bg-transparent md:hover:bg-transparent"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
