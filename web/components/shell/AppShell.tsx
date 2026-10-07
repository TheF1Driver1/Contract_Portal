"use client";

import { useTranslations } from "next-intl";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import type { Alert } from "@/lib/alerts";
import { AppSidebar } from "./AppSidebar";
import { CommandMenu } from "./CommandMenu";
import { MobileTabBar } from "./MobileTabBar";
import { NotificationBell } from "./NotificationBell";

export function AppShell({
  email,
  plan,
  alerts,
  defaultOpen,
  children,
}: {
  email: string;
  plan: string;
  alerts: Alert[];
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar email={email} plan={plan} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" aria-label={t("toggleSidebar")} />
          <CommandMenu />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell alerts={alerts} />
          </div>
        </header>
        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </SidebarInset>
      <MobileTabBar />
      <Toaster richColors position="top-center" />
    </SidebarProvider>
  );
}
