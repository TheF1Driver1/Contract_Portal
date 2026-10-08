"use client";

import { useState, useSyncExternalStore, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft, XCircle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthStatusIcon } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { FormError } from "@/components/auth/FormError";
import { authErrorKey } from "@/components/auth/auth-errors";

const noopSubscribe = () => () => {};

// Read once: Supabase strips the recovery hash from the URL after it creates the session,
// so later re-renders must not re-read it.
let recoveryFlag: boolean | undefined;

function readRecoveryFlag(): boolean {
  if (recoveryFlag !== undefined) return recoveryFlag;
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const type = params.get("type") ?? hashParams.get("type");
  recoveryFlag = type === "recovery" || type === "recover";
  return recoveryFlag;
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // null on the server (URL unknown), so the invalid-link screen does not flash before hydration.
  const isRecovery = useSyncExternalStore(noopSubscribe, readRecoveryFlag, () => null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError(t("resetPage.tooShort"));
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError(t("resetPage.mismatch"));
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(t(`errors.${authErrorKey(error)}`));
      setLoading(false);
    } else {
      router.push("/login");
      router.refresh();
    }
  }

  if (isRecovery === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="danger">
            <XCircle />
          </AuthStatusIcon>
        }
        title={t("resetPage.invalidTitle")}
        description={t("resetPage.invalidDescription")}
        footer={
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("backToLogin")}
          </Link>
        }
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">
            <ArrowLeft aria-hidden />
            {t("resetPage.tryAgain")}
          </Link>
        </Button>
      </AuthShell>
    );
  }

  const describedBy = error ? "reset-error" : undefined;

  return (
    <AuthShell
      title={t("resetPage.title")}
      description={t("resetPage.description")}
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t("resetPage.newPassword")}</Label>
          <PasswordInput
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            aria-describedby={describedBy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            aria-describedby={describedBy}
          />
        </div>

        <FormError id="reset-error">{error}</FormError>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {t("resetPage.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
