"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordPayment } from "@/lib/actions/rent";

export const METHODS = ["ath_movil", "cash", "check", "transfer", "ach", "card", "other"] as const;

export function PaymentSheet({
  open,
  onOpenChange,
  contractId,
  suggested,
  today,
  tenantHasEmail,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contractId: string;
  suggested: number;
  today: string;
  tenantHasEmail: boolean;
}) {
  const t = useTranslations("rent.payment");
  const tm = useTranslations("emails.receipt.method");
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : "");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("ath_movil");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [send, setSend] = useState(tenantHasEmail);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await recordPayment({
      contract_id: contractId,
      amount: Number(amount),
      method,
      received_on: date,
      reference,
      note,
      send_receipt: send && tenantHasEmail,
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    if (res.warning) toast.warning(res.warning);
    else toast.success(t("saved"));
    setReference("");
    setNote("");
    onOpenChange(false);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("title")}
      description={t("description")}
      footer={
        <Button type="submit" form="payment-form" disabled={busy || !(Number(amount) > 0)}>
          {busy && <Loader2 className="animate-spin" />} {t("save")}
        </Button>
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">{t("amount")}</Label>
            <Input id="pay-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="tabular" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date">{t("date")}</Label>
            <Input id="pay-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-method">{t("method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as (typeof METHODS)[number])}>
            <SelectTrigger id="pay-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {tm(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-ref">{t("reference")}</Label>
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} aria-describedby="pay-ref-hint" />
          <p id="pay-ref-hint" className="text-xs text-muted-foreground">{t("referenceHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-note">{t("note")}</Label>
          <Textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
        </div>
        {tenantHasEmail ? (
          <div className="flex items-center gap-2">
            <Checkbox id="pay-send" checked={send} onCheckedChange={(v) => setSend(v === true)} />
            <Label htmlFor="pay-send" className="font-normal">{t("sendReceipt")}</Label>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noEmail")}</p>
        )}
      </form>
    </FormSheet>
  );
}
