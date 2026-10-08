"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/auth/AuthShell";

/** Tenant portal top bar: ContractOS mark and sign out. */
export function PortalHeader() {
  const t = useTranslations("portal");
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await createBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
        <BrandMark href="/portal" />
        <Button variant="ghost" size="lg" onClick={signOut} disabled={signingOut} className="px-3">
          {signingOut ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
          {t("signOut")}
        </Button>
      </div>
    </header>
  );
}
