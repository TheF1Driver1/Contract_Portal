"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Gift, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyReferral, type MyReferral } from "@/lib/actions/referrals";
import { whatsappShareUrl } from "@/lib/referrals/code";

/** "Invite another landlord" card on Settings › Billing (Plan 37). */
export function ReferralCard() {
  const t = useTranslations("referrals.card");
  const locale = useLocale();
  const [data, setData] = useState<MyReferral | null>(null);

  useEffect(() => {
    getMyReferral()
      .then(setData)
      .catch(() => setData({ ok: false, error: "" }));
  }, []);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <section aria-labelledby="referral-title" className="rounded-xl border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Gift className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 id="referral-title" className="text-base font-semibold text-foreground">{t("title")}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {data === null ? (
        <div className="mt-4 space-y-3" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-48" />
        </div>
      ) : !data.ok ? (
        <p role="alert" className="mt-4 text-sm text-danger">{t("loadFailed")}</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="referral-link">{t("linkLabel")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="referral-link"
                readOnly
                value={data.link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 font-mono text-sm sm:h-9"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10 flex-1 sm:h-9 sm:flex-none" onClick={() => copy(data.link)}>
                  <Copy aria-hidden />
                  {t("copy")}
                </Button>
                <Button asChild variant="outline" className="h-10 flex-1 sm:h-9 sm:flex-none">
                  <a href={whatsappShareUrl(t("whatsappText", { link: data.link }))} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden />
                    {t("whatsapp")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <dl aria-label={t("statsLabel")} className="grid grid-cols-2 gap-3 md:w-56">
            <div className="rounded-lg border bg-surface-muted p-3">
              <dt className="text-xs font-medium text-muted-foreground">{t("signedUp")}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground tabular">{data.stats.signedUp}</dd>
            </div>
            <div className="rounded-lg border bg-surface-muted p-3">
              <dt className="text-xs font-medium text-muted-foreground">{t("converted")}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground tabular">{data.stats.converted}</dd>
            </div>
          </dl>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {t("rewardNote")}{" "}
        <Link href={locale.startsWith("en") ? "/en/terms" : "/terminos"} className="font-medium text-primary underline underline-offset-4">
          {t("terms")}
        </Link>
      </p>
    </section>
  );
}
