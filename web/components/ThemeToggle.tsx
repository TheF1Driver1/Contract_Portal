"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedControl } from "@/components/settings/SegmentedControl";

const OPTIONS = [
  { value: "light", key: "light", icon: Sun },
  { value: "dark", key: "dark", icon: Moon },
  { value: "system", key: "system", icon: Monitor },
] as const;

/** Light / dark / system appearance picker. */
export function ThemeToggle() {
  const t = useTranslations("settings.appearance");
  const { theme, setTheme } = useTheme();
  // next-themes only knows the theme after mount; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <SegmentedControl
      label={t("themeLabel")}
      value={mounted ? (theme ?? "system") : undefined}
      onChange={setTheme}
      options={OPTIONS.map((o) => ({ value: o.value, label: t(o.key), icon: o.icon }))}
    />
  );
}
