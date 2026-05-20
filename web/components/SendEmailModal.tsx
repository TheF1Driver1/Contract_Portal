"use client";

import { useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import type { Contract } from "@/lib/types";

interface Props {
  contract: Contract;
  landlordEmail: string;
  onClose: () => void;
}

export default function SendEmailModal({ contract, landlordEmail, onClose }: Props) {
  const tenantEmailDefault = contract.tenant?.email ?? "";

  const [sendToLandlord, setSendToLandlord] = useState(true);
  const [sendToTenant,   setSendToTenant]   = useState(!!tenantEmailDefault);
  const [landlordInput,  setLandlordInput]  = useState(landlordEmail);
  const [tenantInput,    setTenantInput]    = useState(tenantEmailDefault);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<"sent" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    if (!sendToLandlord && !sendToTenant) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sendToLandlord && landlordInput ? { landlordEmail: landlordInput } : {}),
          ...(sendToTenant   && tenantInput   ? { tenantEmail:   tenantInput   } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Send failed");
        setResult("error");
      } else {
        setResult("sent");
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
      setResult("error");
    } finally {
      setLoading(false);
    }
  }

  const canSend = (sendToLandlord && !!landlordInput) || (sendToTenant && !!tenantInput);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5 shadow-2xl"
        style={{ background: "var(--surface-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" style={{ color: "#007aff" }} />
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Email Contract
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--surface-container)" }}
          >
            <X className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {result === "sent" ? (
          <div className="rounded-xl p-4 text-center space-y-2" style={{ background: "rgba(52,199,89,0.12)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34c759" }}>Email sent!</p>
            <button
              className="text-xs underline"
              style={{ color: "var(--text-muted)" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Landlord */}
            <RecipientRow
              label="Landlord"
              checked={sendToLandlord}
              onCheck={setSendToLandlord}
              email={landlordInput}
              onEmail={setLandlordInput}
              editable
            />

            {/* Tenant */}
            <RecipientRow
              label={contract.tenant?.full_name ? `Tenant — ${contract.tenant.full_name}` : "Tenant"}
              checked={sendToTenant}
              onCheck={setSendToTenant}
              email={tenantInput}
              onEmail={setTenantInput}
              editable={!tenantEmailDefault}
              placeholder="tenant@email.com"
            />

            {result === "error" && (
              <p className="text-xs rounded-lg p-2" style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}>
                {errorMsg}
              </p>
            )}

            <button
              className="btn-primary-gradient w-full flex items-center justify-center gap-2"
              disabled={loading || !canSend}
              onClick={handleSend}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {loading ? "Sending…" : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RecipientRow({
  label,
  checked,
  onCheck,
  email,
  onEmail,
  editable = false,
  placeholder = "",
}: {
  label: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  email: string;
  onEmail: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-[#007aff]"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
        />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
      </label>
      {checked && (
        <input
          className="input-tonal w-full text-sm"
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          readOnly={!editable && !!email}
          placeholder={placeholder || "email@example.com"}
          style={!editable && email ? { opacity: 0.7 } : undefined}
        />
      )}
    </div>
  );
}
