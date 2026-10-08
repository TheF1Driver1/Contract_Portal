"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getDigestEmails, setDigestEmails } from "@/lib/actions/messaging";

/** Turns the landlord's daily summary email on or off (Plan 34). */
export function DigestEmailsCard() {
  const t = useTranslations("messaging.digest");
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getDigestEmails().then(setEnabled).catch(() => setEnabled(true));
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    const res = await setDigestEmails(next).catch(() => ({ ok: false as const, error: "" }));
    if (!res.ok) {
      setEnabled(!next);
      toast.error(t("failed"));
    }
  }

  return (
    <Card className="py-4 md:py-5">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="digest-emails">{t("title")}</Label>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Switch id="digest-emails" checked={enabled ?? true} disabled={enabled === null} onCheckedChange={toggle} />
      </CardContent>
    </Card>
  );
}
