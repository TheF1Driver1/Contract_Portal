"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { Contract } from "@/lib/types";

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function TenantSigningClient({ contract }: { contract: Contract }) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const property = contract.property;
  const tenant = contract.tenant;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_signature: signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit signature");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">Lease Signed Successfully</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Your signature has been submitted. Your landlord has been notified.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Tenant Portal</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Review &amp; Sign Your Lease</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Review the details below and draw your signature to complete the agreement.
        </p>
      </div>

      {/* Contract summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Lease Details</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {property && (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Property</p>
                <p className="mt-0.5 text-white">{property.name}</p>
                <p className="text-neutral-400 text-xs">{property.address}, {property.city}, {property.state}</p>
              </div>
              {contract.unit_number && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Unit</p>
                  <p className="mt-0.5 text-white">{contract.unit_number}</p>
                </div>
              )}
            </>
          )}
          {tenant && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Tenant</p>
              <p className="mt-0.5 text-white">{tenant.full_name}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Monthly Rent</p>
            <p className="mt-0.5 text-white font-semibold">{fmtCurrency(contract.rent_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Lease Start</p>
            <p className="mt-0.5 text-white">{fmt(contract.lease_start)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Lease End</p>
            <p className="mt-0.5 text-white">{fmt(contract.lease_end)}</p>
          </div>
          {contract.security_deposit > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Security Deposit</p>
              <p className="mt-0.5 text-white">{fmtCurrency(contract.security_deposit)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Signature */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">Your Signature</h2>
        <SignaturePad label="Tenant Signature" value={signature} onChange={setSignature} />
        <p className="mt-2 text-xs text-neutral-500">
          By signing above, you agree to the terms of the lease agreement.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!signature || submitting}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Submit Signature"
        )}
      </button>
    </form>
  );
}
