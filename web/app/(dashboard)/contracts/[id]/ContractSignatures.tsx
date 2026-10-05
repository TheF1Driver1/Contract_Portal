"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Trash2, X } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";

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
  const router = useRouter();
  const [signingRole, setSigningRole] = useState<SignatureRole | null>(null);
  const [removingRole, setRemovingRole] = useState<SignatureRole | null>(null);
  const [error, setError] = useState("");

  async function handleRemove(role: SignatureRole) {
    const message =
      role === "tenant"
        ? "Remove the tenant signature? The contract will no longer be marked as signed."
        : "Remove the landlord signature?";
    if (!confirm(message)) return;
    setRemovingRole(role);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contractId}/signature?role=${role}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to remove signature"));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingRole(null);
    }
  }

  return (
    <div className="surface-card">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Signatures
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <SignatureSlot
          label={`Tenant${tenantName ? ` — ${tenantName}` : ""}`}
          signature={tenantSignature}
          signLabel="Sign as tenant (in person)"
          removing={removingRole === "tenant"}
          onSign={() => setSigningRole("tenant")}
          onRemove={() => handleRemove("tenant")}
        />
        {coTenantSignatures.map((ct) => (
          <div key={ct.id}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {ct.label}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ct.signature}
              alt={`${ct.label} signature`}
              className="h-20 w-full rounded-xl object-contain"
              style={{ background: "var(--surface-container)" }}
            />
          </div>
        ))}
        <SignatureSlot
          label="Landlord"
          signature={landlordSignature}
          signLabel="Sign as landlord"
          removing={removingRole === "landlord"}
          onSign={() => setSigningRole("landlord")}
          onRemove={() => handleRemove("landlord")}
        />
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {signingRole && (
        <SignatureModal
          contractId={contractId}
          role={signingRole}
          onClose={() => setSigningRole(null)}
          onSaved={() => {
            setSigningRole(null);
            router.refresh();
          }}
        />
      )}
    </div>
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
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        {signature && (
          <button
            onClick={onRemove}
            disabled={removing}
            className="flex items-center gap-1 text-xs font-medium disabled:opacity-50"
            style={{ color: "#ff3b30" }}
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </button>
        )}
      </div>
      {signature ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signature}
          alt={`${label} signature`}
          className="h-20 w-full rounded-xl object-contain"
          style={{ background: "var(--surface-container)" }}
        />
      ) : (
        <button
          onClick={onSign}
          className="btn-tonal flex h-20 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium"
        >
          <PenLine className="h-4 w-4" />
          {signLabel}
        </button>
      )}
    </div>
  );
}

function SignatureModal({
  contractId,
  role,
  onClose,
  onSaved,
}: {
  contractId: string;
  role: SignatureRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!signature) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${contractId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, signature }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to save signature"));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5 shadow-2xl"
        style={{ background: "var(--surface-card)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4" style={{ color: "var(--accent-color)" }} />
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {role === "landlord" ? "Sign as landlord" : "Sign as tenant"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--surface-container)" }}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {role === "tenant" && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Hand this device to the tenant. Saving their signature marks the contract as signed.
          </p>
        )}

        <SignaturePad
          label={role === "landlord" ? "Landlord Signature" : "Tenant Signature"}
          value={signature}
          onChange={setSignature}
        />

        {error && (
          <p className="text-xs rounded-lg p-2" style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!signature || saving}
          className="btn-primary-gradient w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          Save Signature
        </button>
      </div>
    </div>
  );
}
