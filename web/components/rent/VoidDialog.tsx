"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { voidCharge, voidPayment } from "@/lib/actions/rent";

export function VoidDialog({ target, onClose }: { target: { id: string; kind: "payment" | "charge" } | null; onClose: () => void }) {
  const t = useTranslations("rent.void");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    const res = await (target.kind === "payment" ? voidPayment : voidCharge)({ id: target.id, reason });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("done"));
    setReason("");
    onClose();
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">{t("reason")}</Label>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>
              {busy && <Loader2 className="animate-spin" />} {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
