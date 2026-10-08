"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Ban,
  Send,
} from "lucide-react";
import type { Contract, Tenant } from "@/lib/types";
import RenewalModal from "@/components/RenewalModal";
import SendEmailModal from "@/components/SendEmailModal";
import { ConfirmDialog } from "@/components/contracts/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Format = "docx" | "pdf";

export default function ContractActions({
  contract,
  availableTenants = [],
  landlordEmail = "",
}: {
  contract: Contract;
  availableTenants?: Tenant[];
  landlordEmail?: string;
}) {
  const t = useTranslations("contracts.actions");
  const te = useTranslations("contracts.esign");
  const router = useRouter();
  const [generating, setGenerating] = useState<Format | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showRenewal, setShowRenewal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const status = contract.status as string;
  const showRenew = status === "signed" || status === "expired";
  const canSendInvite = status !== "signed" && status !== "expired";
  const tenantHasEmail = !!contract.tenant?.email;
  const tenantHasPhone = !!contract.tenant?.phone;

  async function handleDownload(format: Format) {
    setGenerating(format);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contract.id, format }),
      });
      if (!res.ok) throw new Error(await res.text());
      const contentType = res.headers.get("content-type") ?? "";
      const ext = contentType.includes("pdf") ? "pdf" : "docx";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contract.id}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("downloaded"));
    } catch (e) {
      toast.error(t("generateFailed"), { description: (e as Error).message });
    } finally {
      setGenerating(null);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast.error(t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"));
    setConfirmDelete(false);
    router.refresh();
    router.push("/contracts");
  }

  async function handleSendInvite() {
    if (!tenantHasEmail) {
      toast.error(t("needEmail"));
      return;
    }
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/invite`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("inviteFailed"), { description: typeof json.error === "string" ? json.error : undefined });
      } else {
        toast.success(t("inviteSent", { email: contract.tenant?.email ?? "" }));
        router.refresh();
      }
    } catch (e) {
      toast.error(t("inviteFailed"), { description: (e as Error).message });
    } finally {
      setSendingInvite(false);
    }
  }

  // Sends the lease into the verified signing flow (Plan 31).
  async function handleRequestSignature() {
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/signers`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "");
      toast.success(te("sent"));
      router.refresh();
    } catch (e) {
      toast.error(te("sendFailed"), { description: (e as Error).message || undefined });
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleVoid() {
    setVoiding(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.newContractId !== "string") throw new Error(typeof json.error === "string" ? json.error : "");
      toast.success(te("voided"));
      router.push(`/contracts/new?edit=${json.newContractId}`);
    } catch (e) {
      toast.error(te("voidFailed"), { description: (e as Error).message || undefined });
      setVoiding(false);
    }
  }

  async function handleQuickSms() {
    if (!tenantHasPhone) {
      toast.error(t("needPhone"));
      return;
    }
    setSendingSms(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/quick-sms`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("smsFailed"), { description: typeof json.error === "string" ? json.error : undefined });
      } else {
        toast.success(t("smsSent", { phone: json.phone ?? contract.tenant?.phone ?? "" }));
        router.refresh();
      }
    } catch (e) {
      toast.error(t("smsFailed"), { description: (e as Error).message });
    } finally {
      setSendingSms(false);
    }
  }

  const spin = <Loader2 className="animate-spin" />;

  const requestButton = (
    <Button onClick={handleRequestSignature} disabled={sendingInvite || (!tenantHasEmail && !tenantHasPhone)}>
      {sendingInvite ? spin : <Send />}
      {te("send")}
    </Button>
  );

  const pdfButton = (variant: "default" | "outline") => (
    <Button variant={variant} onClick={() => handleDownload("pdf")} disabled={generating !== null}>
      {generating === "pdf" ? spin : <Download />}
      {t("downloadPdf")}
    </Button>
  );

  const renewButton = (variant: "default" | "outline") => (
    <Button variant={variant} onClick={() => setShowRenewal(true)}>
      <RefreshCw />
      {t("renew")}
    </Button>
  );

  // Primary actions depend on the contract's stage.
  let primary: ReactNode;
  if (status === "draft") {
    primary = (
      <>
        <Button asChild variant="outline">
          <Link href={`/contracts/new?edit=${contract.id}`}>
            <Pencil />
            {t("edit")}
          </Link>
        </Button>
        {requestButton}
      </>
    );
  } else if (status === "sent") {
    primary = (
      <>
        <Button variant="outline" onClick={handleQuickSms} disabled={sendingSms || !tenantHasPhone} title={!tenantHasPhone ? t("needPhone") : undefined}>
          {sendingSms ? spin : <MessageSquare />}
          {t("remindSms")}
        </Button>
        {pdfButton("default")}
      </>
    );
  } else if (status === "signed") {
    primary = (
      <>
        {renewButton("outline")}
        {contract.sealed_pdf_path ? (
          <Button asChild>
            <a href={`/api/contracts/${contract.id}/sealed`}>
              <Download />
              {te("download")}
            </a>
          </Button>
        ) : (
          pdfButton("default")
        )}
      </>
    );
  } else if (status === "expired") {
    primary = (
      <>
        {pdfButton("outline")}
        {renewButton("default")}
      </>
    );
  } else {
    primary = pdfButton("default");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {primary}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("more")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => setShowEmail(true)}>
              <Mail />
              {t("email")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleQuickSms} disabled={sendingSms || !tenantHasPhone}>
              <MessageSquare />
              {tenantHasPhone ? t("sms") : t("needPhone")}
            </DropdownMenuItem>
            {canSendInvite && (
              <DropdownMenuItem onSelect={handleSendInvite} disabled={sendingInvite || !tenantHasEmail}>
                <Link2 />
                {tenantHasEmail ? t("portalInvite") : t("needEmail")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleDownload("pdf")} disabled={generating !== null}>
              <Download />
              {t("downloadPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleDownload("docx")} disabled={generating !== null}>
              <FileText />
              {t("downloadDocx")}
            </DropdownMenuItem>
            {status === "draft" && (
              <DropdownMenuItem asChild>
                <Link href={`/contracts/new?edit=${contract.id}`}>
                  <Pencil />
                  {t("edit")}
                </Link>
              </DropdownMenuItem>
            )}
            {showRenew && (
              <DropdownMenuItem onSelect={() => setShowRenewal(true)}>
                <RefreshCw />
                {t("renew")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {(status === "sent" || status === "signed") && (
              <DropdownMenuItem variant="destructive" onSelect={() => setVoidOpen(true)}>
                <Ban />
                {te("void")}
              </DropdownMenuItem>
            )}
            {status !== "signed" && status !== "cancelled" && (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                {t("delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SendEmailModal
        contract={contract}
        landlordEmail={landlordEmail}
        open={showEmail}
        onOpenChange={setShowEmail}
      />
      {showRenew && (
        <RenewalModal
          contract={contract}
          availableTenants={availableTenants}
          open={showRenewal}
          onOpenChange={setShowRenewal}
        />
      )}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{te("voidTitle")}</DialogTitle>
            <DialogDescription>{te("voidDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">{te("voidReason")}</Label>
            <Textarea id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding || voidReason.trim().length < 3}>
              {voiding ? spin : <Ban />}
              {te("voidConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
      />
    </>
  );
}
