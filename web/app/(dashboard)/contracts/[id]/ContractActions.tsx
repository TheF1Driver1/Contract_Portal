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
} from "lucide-react";
import type { Contract, Tenant } from "@/lib/types";
import RenewalModal from "@/components/RenewalModal";
import SendEmailModal from "@/components/SendEmailModal";
import { ConfirmDialog } from "@/components/contracts/ConfirmDialog";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const [generating, setGenerating] = useState<Format | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showRenewal, setShowRenewal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

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

  const inviteButton = (label: string, variant: "default" | "outline") => (
    <Button
      variant={variant}
      onClick={handleSendInvite}
      disabled={sendingInvite || !tenantHasEmail}
      title={!tenantHasEmail ? t("needEmail") : undefined}
    >
      {sendingInvite ? spin : <Link2 />}
      {label}
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
        {inviteButton(t("send"), "default")}
      </>
    );
  } else if (status === "sent") {
    primary = (
      <>
        <Button variant="outline" onClick={handleQuickSms} disabled={sendingSms || !tenantHasPhone} title={!tenantHasPhone ? t("needPhone") : undefined}>
          {sendingSms ? spin : <MessageSquare />}
          {t("remindSms")}
        </Button>
        {inviteButton(t("resend"), "default")}
      </>
    );
  } else if (status === "signed") {
    primary = (
      <>
        {renewButton("outline")}
        {pdfButton("default")}
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
                {tenantHasEmail ? t("signingLink") : t("needEmail")}
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
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 />
              {t("delete")}
            </DropdownMenuItem>
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
