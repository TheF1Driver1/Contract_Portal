"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, PenLine, Trash2 } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { ConfirmDialog } from "@/components/contracts/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SignatureRole = "landlord" | "tenant";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return typeof json?.error === "string" ? json.error : fallback;
}

export default function ContractSignatures({
  contractId,
  tenantName,
  landlordSignature,
  tenantSignature,
  coTenantSignatures = [],
}: {
  contractId: string;
  tenantName?: string | null;
  landlordSignature?: string | null;
  tenantSignature?: string | null;
  coTenantSignatures?: { id: string; label: string; signature: string }[];
}) {
  const t = useTranslations("contracts.signatures");
  const router = useRouter();
  const [signingRole, setSigningRole] = useState<SignatureRole | null>(null);
  const [confirmRole, setConfirmRole] = useState<SignatureRole | null>(null);
  const [removingRole, setRemovingRole] = useState<SignatureRole | null>(null);

  async function handleRemove(role: SignatureRole) {
    setRemovingRole(role);
    try {
      const res = await fetch(`/api/contracts/${contractId}/signature?role=${role}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, t("removeFailed")));
      toast.success(t("removed"));
      setConfirmRole(null);
      router.refresh();
    } catch (e) {
      toast.error(t("removeFailed"), { description: (e as Error).message });
    } finally {
      setRemovingRole(null);
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <SignatureSlot
          label={tenantName ? t("tenantNamed", { name: tenantName }) : t("tenant")}
          signature={tenantSignature}
          signLabel={t("signTenant")}
          removing={removingRole === "tenant"}
          onSign={() => setSigningRole("tenant")}
          onRemove={() => setConfirmRole("tenant")}
        />
        {coTenantSignatures.map((ct) => (
          <div key={ct.id} className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{ct.label}</p>
            <SignatureImage src={ct.signature} alt={t("signatureOf", { who: ct.label })} />
          </div>
        ))}
        <SignatureSlot
          label={t("landlord")}
          signature={landlordSignature}
          signLabel={t("signLandlord")}
          removing={removingRole === "landlord"}
          onSign={() => setSigningRole("landlord")}
          onRemove={() => setConfirmRole("landlord")}
        />
      </div>

      <SignatureDialog
        contractId={contractId}
        role={signingRole}
        onClose={() => setSigningRole(null)}
        onSaved={() => {
          setSigningRole(null);
          toast.success(t("saved"));
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmRole !== null}
        onOpenChange={(v) => !v && setConfirmRole(null)}
        title={t("removeTitle")}
        description={confirmRole === "tenant" ? t("removeTenantConfirm") : t("removeLandlordConfirm")}
        confirmLabel={t("remove")}
        onConfirm={() => (confirmRole ? handleRemove(confirmRole) : undefined)}
      />
    </>
  );
}

function SignatureImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-20 w-full rounded-lg border bg-surface-muted object-contain" />
  );
}

function SignatureSlot({
  label,
  signature,
  signLabel,
  removing,
  onSign,
  onRemove,
}: {
  label: string;
  signature?: string | null;
  signLabel: string;
  removing: boolean;
  onSign: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("contracts.signatures");
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {signature && (
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={removing} className="text-danger hover:text-danger">
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {t("remove")}
          </Button>
        )}
      </div>
      {signature ? (
        <SignatureImage src={signature} alt={t("signatureOf", { who: label })} />
      ) : (
        <Button variant="outline" onClick={onSign} className="h-20 w-full border-dashed">
          <PenLine />
          {signLabel}
        </Button>
      )}
    </div>
  );
}

function SignatureDialog({
  contractId,
  role,
  onClose,
  onSaved,
}: {
  contractId: string;
  role: SignatureRole | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("contracts.signatures");
  const tc = useTranslations("common");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setSignature("");
    setError("");
    onClose();
  }

  async function handleSave() {
    if (!signature || !role) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contractId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, signature }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, t("saveFailed")));
      setSignature("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      toast.error(t("saveFailed"), { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={(v) => !v && !saving && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role === "landlord" ? t("signLandlord") : t("signTenantTitle")}</DialogTitle>
          {role === "tenant" && <DialogDescription>{t("tenantHint")}</DialogDescription>}
        </DialogHeader>

        {role && (
          <SignaturePad
            label={role === "landlord" ? t("landlordSignature") : t("tenantSignature")}
            value={signature}
            onChange={setSignature}
          />
        )}

        {error && (
          <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!signature || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <PenLine />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
