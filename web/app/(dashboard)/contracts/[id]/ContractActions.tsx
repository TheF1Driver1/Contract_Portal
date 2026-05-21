"use client";

import { useState } from "react";
import { Download, Loader2, Trash2, Mail, Pencil, Link2, Check } from "lucide-react";
import type { Contract, Tenant } from "@/lib/types";
import { useRouter } from "next/navigation";
import RenewalModal from "@/components/RenewalModal";
import SendEmailModal from "@/components/SendEmailModal";

export default function ContractActions({
  contract,
  availableTenants = [],
  landlordEmail = "",
}: {
  contract: Contract;
  availableTenants?: Tenant[];
  landlordEmail?: string;
}) {
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const router = useRouter();

  async function handleDownload(format: "docx" | "pdf") {
    format === "pdf" ? setGeneratingPdf(true) : setGeneratingDocx(true);
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
    } catch (e) {
      alert("Failed to generate document: " + (e as Error).message);
    } finally {
      setGeneratingDocx(false);
      setGeneratingPdf(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this contract? This cannot be undone.")) return;
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    if (!res.ok) { alert("Failed to delete contract. Please try again."); return; }
    router.refresh();
    router.push("/contracts");
  }

  async function handleSendInvite() {
    setSendingInvite(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/invite`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? "Failed to send invite");
      } else {
        setInviteSent(true);
        router.refresh();
        setTimeout(() => setInviteSent(false), 4000);
      }
    } finally {
      setSendingInvite(false);
    }
  }

  const showRenew = contract.status === "signed" || contract.status === "expired";
  const canSendInvite = contract.status !== "signed" && contract.status !== "expired";
  const tenantHasEmail = !!(contract as { tenant?: { email?: string | null } }).tenant?.email;

  return (
    <>
    {showEmail && (
      <SendEmailModal
        contract={contract}
        landlordEmail={landlordEmail}
        onClose={() => setShowEmail(false)}
      />
    )}
    <div className="flex flex-wrap items-center gap-2">
      {contract.status === "draft" && (
        <a
          href={`/contracts/new?edit=${contract.id}`}
          className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </a>
      )}
      {showRenew && (
        <RenewalModal contract={contract} availableTenants={availableTenants} />
      )}
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        onClick={() => setShowEmail(true)}
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </button>
      {canSendInvite && (
        <div className="relative">
          <button
            className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            onClick={handleSendInvite}
            disabled={sendingInvite || !tenantHasEmail}
            title={!tenantHasEmail ? "Add tenant email first" : inviteSent ? "Invite sent!" : "Send signing link to tenant"}
          >
            {sendingInvite ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : inviteSent ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {inviteSent ? "Sent!" : "Send Signing Link"}
          </button>
          {inviteError && (
            <p className="absolute top-full mt-1 left-0 text-xs text-red-400 whitespace-nowrap">
              {inviteError}
            </p>
          )}
        </div>
      )}
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        onClick={() => handleDownload("docx")}
        disabled={generatingDocx}
      >
        {generatingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        DOCX
      </button>
      <button
        className="btn-tonal flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        onClick={() => handleDownload("pdf")}
        disabled={generatingPdf}
      >
        {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </button>
      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ background: "rgba(255,59,48,0.12)", color: "#ff3b30" }}
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
    </>
  );
}
