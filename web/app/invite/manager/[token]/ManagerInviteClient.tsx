"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, CheckCircle2, XCircle, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthStatusIcon } from "@/components/auth/AuthShell";
import { FormError } from "@/components/auth/FormError";

interface Props {
  token: string;
  managerEmail: string;
  ownerName: string;
  properties: { id: string; name: string; address: string }[];
}

export default function ManagerInviteClient({ token, managerEmail, ownerName, properties }: Props) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bold = (chunks: React.ReactNode) => <strong className="font-medium text-foreground break-all">{chunks}</strong>;

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/managers/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/invite/manager/${token}`);
          return;
        }
        throw new Error(typeof data.error === "string" ? data.error : t("manager.genericError"));
      }
      setDone(action === "accept" ? "accepted" : "declined");
    } catch (e) {
      setError((e as Error).message || t("manager.genericError"));
    } finally {
      setLoading(null);
    }
  }

  if (done === "accepted") {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="success">
            <CheckCircle2 />
          </AuthStatusIcon>
        }
        title={t("manager.acceptedTitle")}
        description={t("manager.acceptedDescription", { owner: ownerName })}
      >
        <Button asChild size="lg" className="w-full">
          <a href="/dashboard">{t("manager.goDashboard")}</a>
        </Button>
      </AuthShell>
    );
  }

  if (done === "declined") {
    return (
      <AuthShell
        media={
          <AuthStatusIcon tone="neutral">
            <XCircle />
          </AuthStatusIcon>
        }
        title={t("manager.declinedTitle")}
        description={t("manager.declinedDescription", { owner: ownerName })}
      >
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/">{t("home")}</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      media={
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <Users className="size-5" aria-hidden />
        </span>
      }
      title={t("manager.title")}
      description={t.rich("manager.description", { owner: ownerName, email: managerEmail, b: bold })}
    >
      <section aria-labelledby="manager-properties" className="mb-5">
        <h2 id="manager-properties" className="mb-2 text-xs font-medium text-muted-foreground">
          {t("manager.propertiesLabel")}
        </h2>
        <ul className="space-y-2">
          {properties.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
              <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.address}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <div className="mb-4">
          <FormError>{error}</FormError>
        </div>
      )}

      <p className="mb-5 text-xs text-muted-foreground">
        {t.rich("manager.loginNote", { email: managerEmail, b: bold })}
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => handleAction("decline")}
          disabled={loading !== null}
        >
          {loading === "decline" ? <Loader2 className="animate-spin" aria-hidden /> : <XCircle aria-hidden />}
          {t("manager.decline")}
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={() => handleAction("accept")}
          disabled={loading !== null}
        >
          {loading === "accept" ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
          {t("manager.accept")}
        </Button>
      </div>
    </AuthShell>
  );
}
