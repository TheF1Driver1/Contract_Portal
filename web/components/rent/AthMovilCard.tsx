"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, CircleDot, Info, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { connectAthMovil, disconnectAthMovil } from "@/lib/actions/athmovil";

export type AthStatus = { connected: boolean; businessName: string | null; connectedAt: string | null };

/** Landlord's ATH Business connection on the Cobros page. */
export function AthMovilCard({ status }: { status: AthStatus }) {
  const t = useTranslations("rent.ath");
  const f = useFormatter();
  const [editing, setEditing] = useState(!status.connected);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await connectAthMovil({
      public_token: String(fd.get("public_token") ?? ""),
      private_token: String(fd.get("private_token") ?? ""),
      business_name: String(fd.get("business_name") ?? ""),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("connected"));
    setEditing(false);
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectAthMovil();
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("disconnected"));
    setEditing(true);
  }

  return (
    <section aria-labelledby="ath-heading" className="mt-6 rounded-xl border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
            <Smartphone className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="ath-heading" className="text-base font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        {status.connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> {t("statusOn")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <CircleDot className="size-3.5" aria-hidden /> {t("statusOff")}
          </span>
        )}
      </div>

      {status.connected && (
        <p className="mt-3 text-sm">
          {t("connectedSince", {
            date: status.connectedAt ? f.dateTime(new Date(status.connectedAt), { dateStyle: "medium" }) : "—",
            business: status.businessName || t("noName"),
          })}
        </p>
      )}

      {editing ? (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
          </ol>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ath-business">{t("businessName")}</Label>
              <Input id="ath-business" name="business_name" maxLength={80} defaultValue={status.businessName ?? ""} aria-describedby="ath-business-hint" />
              <p id="ath-business-hint" className="text-xs text-muted-foreground">{t("businessNameHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ath-public">{t("publicToken")}</Label>
              <Input id="ath-public" name="public_token" required minLength={10} maxLength={200} autoComplete="off" spellCheck={false} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ath-private">{t("privateToken")}</Label>
              <Input
                id="ath-private"
                name="private_token"
                type="password"
                maxLength={200}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-describedby="ath-private-hint"
              />
              <p id="ath-private-hint" className="text-xs text-muted-foreground">{t("privateTokenHint")}</p>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("noSandbox")}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("security")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {status.connected ? t("save") : t("connect")}
            </Button>
            {status.connected && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            {t("update")}
          </Button>
          <Button variant="ghost" className="text-danger" onClick={() => setConfirming(true)}>
            {t("disconnect")}
          </Button>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disconnectTitle")}</DialogTitle>
            <DialogDescription>{t("disconnectBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={disconnect}>
              {busy && <Loader2 className="animate-spin" />} {t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
