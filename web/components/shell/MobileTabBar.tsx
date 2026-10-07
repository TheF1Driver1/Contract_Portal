"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { NAV_GROUPS, MOBILE_TABS, isActive } from "./nav";
import { cn } from "@/lib/utils";

const ALL = NAV_GROUPS.flatMap((g) => g.items);

export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const tabs = MOBILE_TABS.map((href) => ALL.find((i) => i.href === href)!);
  const onMore = !tabs.some((tab) => isActive(pathname, tab.href));

  return (
    <nav
      aria-label={t("navigation")}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-xs",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className="size-5" />
            {t(tab.key)}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className={cn("flex flex-col items-center gap-1 py-2 text-xs", onMore ? "text-primary" : "text-muted-foreground")}
      >
        <MoreHorizontal className="size-5" />
        {t("more")}
      </button>
    </nav>
  );
}
