"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acknowledgeInspection } from "@/lib/actions/inspections";

/** "Confirmo que revisé esta inspección": typed name, recorded with time and IP. Not a signature. */
export function InspectionAck({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("inspections.portal");
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await acknowledgeInspection({ id: inspectionId, name, confirm });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("acked"));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="ack-title">
      <div className="space-y-1">
        <h2 id="ack-title" className="text-base font-semibold text-foreground">
          {t("ackTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("ackBody")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ack-name">{t("ackName")}</Label>
        <Input id="ack-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" required />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="ack-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
        <Label htmlFor="ack-confirm" className="font-normal leading-snug">
          {t("ackConfirm")}
        </Label>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy || !confirm || name.trim().length < 2}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {t("ackAction")}
      </Button>
    </form>
  );
}
