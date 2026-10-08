"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCharge } from "@/lib/actions/rent";

export function ChargeSheet({ open, onOpenChange, contractId, today }: { open: boolean; onOpenChange: (o: boolean) => void; contractId: string; today: string }) {
  const t = useTranslations("rent.charge");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(today);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addCharge({ contract_id: contractId, amount: Number(amount), due_date: due, description });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("saved"));
    setAmount("");
    setDescription("");
    onOpenChange(false);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("title")}
      description={t("description")}
      footer={
        <Button type="submit" form="charge-form" disabled={busy || !(Number(amount) > 0) || !description.trim()}>
          {busy && <Loader2 className="animate-spin" />} {t("save")}
        </Button>
      }
    >
      <form id="charge-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="charge-desc">{t("descriptionLabel")}</Label>
          <Input id="charge-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="charge-amount">{t("amount")}</Label>
            <Input id="charge-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="tabular" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="charge-due">{t("dueDate")}</Label>
            <Input id="charge-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
          </div>
        </div>
      </form>
    </FormSheet>
  );
}
