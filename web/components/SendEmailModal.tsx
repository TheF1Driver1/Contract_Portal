"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import type { Contract } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  contract: Contract;
  landlordEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Email the generated contract to the landlord and/or tenant. */
export default function SendEmailModal({ contract, landlordEmail, open, onOpenChange }: Props) {
  const t = useTranslations("contracts.email");
  const tc = useTranslations("common");
  const tenantEmailDefault = contract.tenant?.email ?? "";

  const [sendToLandlord, setSendToLandlord] = useState(true);
  const [sendToTenant, setSendToTenant] = useState(!!tenantEmailDefault);
  const [landlordInput, setLandlordInput] = useState(landlordEmail);
  const [tenantInput, setTenantInput] = useState(tenantEmailDefault);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    if (!sendToLandlord && !sendToTenant) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sendToLandlord && landlordInput ? { landlordEmail: landlordInput } : {}),
          ...(sendToTenant && tenantInput ? { tenantEmail: tenantInput } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : t("failed");
        setErrorMsg(msg);
        toast.error(t("failed"), { description: msg });
      } else {
        toast.success(t("sent"));
        onOpenChange(false);
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
      toast.error(t("failed"), { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const canSend = (sendToLandlord && !!landlordInput) || (sendToTenant && !!tenantInput);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RecipientRow
            id="email-landlord"
            label={t("landlord")}
            checked={sendToLandlord}
            onCheck={setSendToLandlord}
            email={landlordInput}
            onEmail={setLandlordInput}
            editable
          />
          <RecipientRow
            id="email-tenant"
            label={contract.tenant?.full_name ? t("tenantNamed", { name: contract.tenant.full_name }) : t("tenant")}
            checked={sendToTenant}
            onCheck={setSendToTenant}
            email={tenantInput}
            onEmail={setTenantInput}
            editable={!tenantEmailDefault}
            placeholder={t("tenantPlaceholder")}
          />
          {errorMsg && (
            <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-danger">
              {errorMsg}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={loading || !canSend} onClick={handleSend}>
            {loading ? <Loader2 className="animate-spin" /> : <Mail />}
            {loading ? t("sending") : tc("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipientRow({
  id,
  label,
  checked,
  onCheck,
  email,
  onEmail,
  editable = false,
  placeholder = "",
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  email: string;
  onEmail: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations("contracts.email");
  return (
    <div className="space-y-2">
      <div className="flex min-h-10 items-center gap-2.5">
        <Checkbox id={`${id}-check`} checked={checked} onCheckedChange={(v) => onCheck(v === true)} />
        <Label htmlFor={`${id}-check`} className="cursor-pointer">
          {label}
        </Label>
      </div>
      {checked && (
        <Input
          id={`${id}-input`}
          aria-label={t("emailFor", { who: label })}
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          readOnly={!editable && !!email}
          placeholder={placeholder || "email@example.com"}
          className={!editable && email ? "bg-surface-muted text-muted-foreground" : undefined}
        />
      )}
    </div>
  );
}
