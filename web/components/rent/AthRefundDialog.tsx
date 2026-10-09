"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { athRefundInfo, clearAthRefund, refundAth, type AthRefundInfo } from "@/lib/actions/athmovil";

/** Refund (part of) an ATH Móvil payment back to the tenant. */
export function AthRefundDialog({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const t = useTranslations("rent.athRefund");
  const [info, setInfo] = useState<AthRefundInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let live = true;
    // State starts fresh per payment: the parent keys this component by paymentId.
    athRefundInfo(paymentId).then((r) => {
      if (!live) return;
      setInfo(r);
      if (r.ok) setAmount(r.refundable.toFixed(2));
    });
    return () => {
      live = false;
    };
  }, [paymentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentId) return;
    setBusy(true);
    const res = await refundAth({ payment_id: paymentId, amount: Number(amount), message: message || null, confirm });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.fullyRefunded ? t("doneFull") : t("donePartial"));
    onClose();
  }

  async function clearUnknown(id: string) {
    setBusy(true);
    const res = await clearAthRefund(id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    if (paymentId) setInfo(await athRefundInfo(paymentId));
  }

  const ready = info?.ok ? info : null;
  return (
    <Dialog open={!!paymentId} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>

          {!info && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label={t("loading")} />}
          {info && !info.ok && <p className="text-sm text-danger">{info.error}</p>}

          {ready && ready.unknownRefundId && (
            <div role="alert" className="space-y-2 rounded-lg border border-warning bg-warning-soft p-3 text-sm">
              <p>{t("unknown")}</p>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => clearUnknown(ready.unknownRefundId!)}>
                {t("clearUnknown")}
              </Button>
            </div>
          )}

          {ready && !ready.unknownRefundId && !ready.hasPrivateToken && <p className="text-sm text-muted-foreground">{t("noPrivateToken")}</p>}

          {ready && !ready.unknownRefundId && ready.hasPrivateToken && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ath-refund-amount">{t("amount", { max: ready.refundable.toFixed(2) })}</Label>
                <Input
                  id="ath-refund-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max={ready.refundable}
                  step="0.01"
                  className="tabular"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ath-refund-message">{t("message")}</Label>
                <Input id="ath-refund-message" maxLength={50} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("messagePlaceholder")} />
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="ath-refund-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
                <Label htmlFor="ath-refund-confirm" className="font-normal leading-snug">{t("confirm")}</Label>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            {ready && !ready.unknownRefundId && ready.hasPrivateToken && (
              <Button type="submit" variant="destructive" disabled={busy || !confirm || !(Number(amount) > 0)}>
                {busy && <Loader2 className="animate-spin" />} {t("submit")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
