"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, ArrowRight, Building2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { FormError } from "@/components/auth/FormError";
import { authErrorKey } from "@/components/auth/auth-errors";

interface Props {
  token: string;
  tenantEmail: string;
  tenantName: string;
  contractId: string;
  propertyName: string;
}

type Tab = "signup" | "signin";

class RedeemError extends Error {}

export default function InviteSignupClient({
  token,
  tenantEmail,
  tenantName,
  contractId: _contractId,
  propertyName,
}: Props) {
  const t = useTranslations("invite");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<Tab>("signup");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(tenantName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function redeem() {
    const res = await fetch(`/api/invite/${token}/redeem`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new RedeemError(json.error ?? "Failed to redeem invite");
    // The role claim in the access token changed (landlord -> tenant); refresh it.
    await supabase.auth.refreshSession();
    return json.contractId as string;
  }

  function showError(err: unknown) {
    setError(err instanceof RedeemError ? t("tenant.redeemFailed") : tAuth(`errors.${authErrorKey(err)}`));
    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: tenantEmail,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;

      const cId = await redeem();
      router.push(`/portal/sign/${cId}`);
    } catch (err) {
      showError(err);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tenantEmail,
        password,
      });
      if (signInError) throw signInError;

      const cId = await redeem();
      router.push(`/portal/sign/${cId}`);
    } catch (err) {
      showError(err);
    }
  }

  const describedBy = error ? "invite-error" : undefined;

  return (
    <AuthShell
      wide
      media={
        <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-3 text-primary-soft-foreground">
          <Building2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="text-xs font-medium">{t("tenant.contextLabel")}</p>
            <p className="mt-0.5">
              {tenantName ? `${t("tenant.greeting", { name: tenantName })} ` : ""}
              {t.rich("tenant.context", {
                property: propertyName,
                b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
              })}
            </p>
          </div>
        </div>
      }
      title={tab === "signup" ? t("tenant.titleSignup") : t("tenant.titleSignin")}
      description={t("tenant.description")}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setError("");
        }}
        className="mb-5"
      >
        <TabsList className="grid h-10 w-full grid-cols-2">
          <TabsTrigger value="signup">{t("tenant.tabSignup")}</TabsTrigger>
          <TabsTrigger value="signin">{t("tenant.tabSignin")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={tab === "signup" ? handleSignup : handleSignin} className="space-y-4">
        {tab === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">{t("tenant.fullName")}</Label>
            <Input
              id="invite-name"
              name="name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder={t("tenant.fullNamePlaceholder")}
              className="h-10"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t("tenant.email")}</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="username"
            value={tenantEmail}
            readOnly
            aria-readonly
            className="h-10 bg-surface-muted text-muted-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-password">{t("tenant.password")}</Label>
          <PasswordInput
            key={tab}
            id="invite-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            aria-describedby={tab === "signup" ? (describedBy ? `invite-password-hint ${describedBy}` : "invite-password-hint") : describedBy}
          />
          {tab === "signup" && (
            <p id="invite-password-hint" className="text-xs text-muted-foreground">
              {t("tenant.passwordHint")}
            </p>
          )}
        </div>

        <FormError id="invite-error">{error}</FormError>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {tab === "signup" ? t("tenant.submitSignup") : t("tenant.submitSignin")}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>
    </AuthShell>
  );
}
