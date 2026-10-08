"use client";

import { baseLocale } from "@/i18n/locales";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase";
import { SegmentedControl } from "./SegmentedControl";

/** Español / English picker. Saves to the profile, cookie and session claim. */
export function LanguageSelect() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  async function change(next: string) {
    if (next !== "es" && next !== "en") return;
    setSaving(true);
    try {
      const res = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) throw new Error();
      // Refresh the access token so the locale claim read by the proxy matches.
      await createBrowserClient().auth.refreshSession();
      startTransition(() => router.refresh());
      toast.success(next === "es" ? "Idioma actualizado" : "Language updated");
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SegmentedControl
      label={t("label")}
      value={baseLocale(locale)}
      onChange={change}
      disabled={saving || pending}
      options={[
        { value: "es", label: t("es") },
        { value: "en", label: t("en") },
      ]}
    />
  );
}
