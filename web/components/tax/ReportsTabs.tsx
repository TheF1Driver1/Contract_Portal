"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reports", key: "overview" },
  { href: "/reports/annual", key: "annual" },
  { href: "/reports/schedule-e", key: "scheduleE" },
  { href: "/reports/crim", key: "crim" },
] as const;

/** Section links shared by every page under /reports. */
export function ReportsTabs() {
  const t = useTranslations("tax.tabs");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="inline-flex min-w-max gap-1 rounded-lg border border-border bg-surface-muted p-1">
        {TABS.map(({ href, key }) => {
          const active = href === "/reports" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8",
                  active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
