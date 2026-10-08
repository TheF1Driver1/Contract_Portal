"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { track } from "@vercel/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { FormError } from "@/components/auth/FormError";
import { authErrorKey } from "@/components/auth/auth-errors";
import { claimReferral } from "@/lib/actions/referrals";

const legalLink = (href: string) =>
  function LegalLink(chunks: React.ReactNode) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-4"
      >
        {chunks}
      </Link>
    );
  };

export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createBrowserClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setTermsError(true);
      setError(t("signupPage.termsRequired"));
      return;
    }
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, terms_accepted_at: new Date().toISOString() },
      },
    });

    if (error) {
      setError(t(`errors.${authErrorKey(error)}`));
      setLoading(false);
    } else {
      // Signed up through a referral link: record it now if we already have a
      // session; otherwise /auth/callback does it after email confirmation.
      if (data.session) await claimReferral().catch(() => null);
      // Visitors who picked a paid plan on /pricing continue to checkout
      const plan = new URLSearchParams(window.location.search).get("plan");
      track("signup", { plan: plan ?? "free" });
      const paid = plan === "propietario" || plan === "inversionista";
      router.push(paid ? `/settings/billing?plan=${plan}` : "/dashboard");
      router.refresh();
    }
  }

  const describedBy = error ? "signup-error" : undefined;

  return (
    <AuthShell
      title={t("signupPage.title")}
      description={t("signupPage.description")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("signInLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("signupPage.fullName")}</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder={t("signupPage.fullNamePlaceholder")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10"
            aria-describedby={describedBy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            aria-describedby={describedBy ? `password-hint ${describedBy}` : "password-hint"}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t("signupPage.passwordHint")}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={(v) => {
              setAccepted(v === true);
              if (v === true) {
                setTermsError(false);
                setError("");
              }
            }}
            aria-invalid={termsError ? true : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="block text-sm font-normal leading-snug text-muted-foreground">
            {t.rich("signupPage.terms", {
              terms: legalLink("/terminos"),
              privacy: legalLink("/privacidad"),
            })}
          </Label>
        </div>

        <FormError id="signup-error">{error}</FormError>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {t("signUpButton")}
        </Button>
      </form>
    </AuthShell>
  );
}
