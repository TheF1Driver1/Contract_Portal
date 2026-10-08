"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthStatusIcon } from "@/components/auth/AuthShell";
import { FormError } from "@/components/auth/FormError";
import { authErrorKey } from "@/components/auth/auth-errors";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(t(`errors.${authErrorKey(error)}`));
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  const footer = (
    <>
      {t("forgotPage.remembered")}{" "}
      <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
        {t("signInLink")}
      </Link>
    </>
  );

  if (success) {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="success">
            <MailCheck />
          </AuthStatusIcon>
        }
        title={t("forgotPage.sentTitle")}
        description={t.rich("forgotPage.sentDescription", {
          email,
          b: (chunks) => <strong className="font-medium text-foreground break-all">{chunks}</strong>,
        })}
        footer={footer}
      >
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/login">
              <ArrowLeft aria-hidden />
              {t("backToLogin")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              setSuccess(false);
              setEmail("");
            }}
          >
            {t("forgotPage.tryAnother")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("forgotPage.title")} description={t("forgotPage.description")} footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">{t("email")}</Label>
          <Input
            id="reset-email"
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
            aria-describedby={error ? "forgot-error" : undefined}
          />
        </div>

        <FormError id="forgot-error">{error}</FormError>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {t("sendResetLink")}
        </Button>
      </form>
    </AuthShell>
  );
}
