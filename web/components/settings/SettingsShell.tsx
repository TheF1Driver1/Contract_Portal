import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/app/PageHeader";
import { SettingsNav } from "./SettingsNav";

/** Shared frame for every settings screen: page title plus the settings sub-navigation. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsNav />
      {children}
    </div>
  );
}
