"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Languages, Loader2, Lock, Mail, Palette, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { LanguageSelect } from "@/components/settings/LanguageSelect";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 py-4 md:py-5">
      <CardHeader className="flex items-start gap-3 px-4 md:px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-base">
            <h3>{title}</h3>
          </CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-5">{children}</CardContent>
    </Card>
  );
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ProfilePage() {
  const t = useTranslations("settings.profile");
  const supabase = createBrowserClient();

  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setCurrentEmail(data.user.email ?? "");
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.phone) setPhone(formatPhone(profile.phone));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === currentEmail) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("email.sent"));
      setCurrentEmail(newEmail.trim());
      setNewEmail("");
    }
    setEmailLoading(false);
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo: `${base}/auth/callback?next=/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("password.sent", { email: currentEmail }));
    }
    setResetLoading(false);
  }

  async function handlePhoneUpdate(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError(t("phone.invalid"));
      return;
    }
    setPhoneLoading(true);
    setPhoneError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhoneLoading(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ phone: formatPhone(digits) })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("phone.saved"));
    }
    setPhoneLoading(false);
  }

  return (
    <SettingsShell>
      <SectionHeader title={t("title")} description={currentEmail || t("description")} />

      <div className="grid max-w-2xl gap-4">
        <SectionCard icon={Mail} title={t("email.title")} description={t("email.description")}>
          <form onSubmit={handleEmailUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">{t("email.current")}</Label>
              <Input id="current-email" type="email" value={currentEmail} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">{t("email.new")}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("email.placeholder")}
                autoComplete="email"
                className="h-10 sm:h-9"
              />
            </div>
            <Button type="submit" disabled={emailLoading || !newEmail.trim()} className="h-10 sm:h-9">
              {emailLoading && <Loader2 className="animate-spin" aria-hidden />}
              {t("email.submit")}
            </Button>
          </form>
        </SectionCard>

        <SectionCard icon={Lock} title={t("password.title")} description={t("password.description")}>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.rich("password.body", {
                email: currentEmail,
                strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </p>
            <Button type="submit" variant="outline" disabled={resetLoading || !currentEmail} className="h-10 sm:h-9">
              {resetLoading && <Loader2 className="animate-spin" aria-hidden />}
              {t("password.submit")}
            </Button>
          </form>
        </SectionCard>

        <SectionCard icon={Phone} title={t("phone.title")} description={t("phone.description")}>
          <form onSubmit={handlePhoneUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone.label")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(formatPhone(e.target.value)); setPhoneError(null); }}
                placeholder="787-555-0123"
                autoComplete="tel"
                aria-invalid={phoneError ? true : undefined}
                aria-describedby="phone-help"
                className="h-10 sm:h-9"
              />
              <p id="phone-help" className={phoneError ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
                {phoneError ?? t("phone.help")}
              </p>
            </div>
            <Button type="submit" disabled={phoneLoading} className="h-10 sm:h-9">
              {phoneLoading && <Loader2 className="animate-spin" aria-hidden />}
              {t("phone.submit")}
            </Button>
          </form>
        </SectionCard>

        <SectionCard icon={Palette} title={t("appearance.title")} description={t("appearance.description")}>
          <ThemeToggle />
        </SectionCard>

        <SectionCard icon={Languages} title={t("language.title")} description={t("language.description")}>
          <LanguageSelect />
        </SectionCard>
      </div>
    </SettingsShell>
  );
}
