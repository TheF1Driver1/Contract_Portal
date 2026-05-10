"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { RefreshCw, X, Loader2, Plus, Minus } from "lucide-react";
import type { Contract, ContractOccupant, Tenant } from "@/lib/types";

interface OccupantEntry {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  license_number: string | null;
  current_address: string | null;
  date_of_birth: string | null;
  tenant_id: string | null;
  include: boolean;
}

interface Props {
  contract: Contract & { occupants?: ContractOccupant[] };
  availableTenants: Tenant[];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function RenewalModal({ contract, availableTenants }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Pre-fill from existing contract. Dates default to: start = day after current end
  const defaultStart = addMonths(contract.lease_end, 0)
    .replace(/\d+$/, String(parseInt(contract.lease_end.slice(-2)) + 1).padStart(2, "0"));

  const [leaseStart, setLeaseStart] = useState(() => {
    const d = new Date(contract.lease_end);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [leaseMonths, setLeaseMonths] = useState(contract.lease_months);
  const [rentAmount, setRentAmount] = useState(String(contract.rent_amount));
  const [securityDeposit, setSecurityDeposit] = useState(String(contract.security_deposit));
  const [lateFeeType, setLateFeeType] = useState(contract.late_fee_type);
  const [lateFeeFixed, setLateFeeFixed] = useState(String(contract.late_fee_fixed_amount));
  const [lateFeeDaily, setLateFeeDaily] = useState(String(contract.late_fee_daily_amount));

  // Tenants: primary + co-tenants (all toggleable — any can become primary)
  const [occupants, setOccupants] = useState<OccupantEntry[]>([
    {
      id: contract.tenant_id,
      full_name: contract.tenant?.full_name ?? "",
      email: contract.tenant?.email ?? null,
      phone: contract.tenant?.phone ?? null,
      ssn_last4: contract.tenant?.ssn_last4 ?? null,
      license_number: contract.tenant?.license_number ?? null,
      current_address: contract.tenant?.current_address ?? null,
      date_of_birth: contract.tenant?.date_of_birth ?? null,
      tenant_id: contract.tenant_id,
      include: true,
    },
    ...(contract.occupants ?? [])
      .filter((o) => o.role === "co_tenant")
      .map((o) => ({
        id: o.id,
        full_name: o.full_name,
        email: o.email,
        phone: o.phone,
        ssn_last4: o.ssn_last4,
        license_number: o.license_number,
        current_address: o.current_address,
        date_of_birth: o.date_of_birth,
        tenant_id: o.tenant_id,
        include: true,
      })),
  ]);

  // New tenant to add
  const [addingTenant, setAddingTenant] = useState(false);
  const [newTenantId, setNewTenantId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const leaseEnd = (() => {
    const d = new Date(leaseStart);
    d.setMonth(d.getMonth() + leaseMonths);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  function toggleOccupant(id: string) {
    setOccupants((prev) => prev.map((o) => o.id === id ? { ...o, include: !o.include } : o));
  }

  function addNewTenant() {
    const t = availableTenants.find((t) => t.id === newTenantId);
    if (!t) return;
    if (occupants.find((o) => o.tenant_id === t.id)) return;
    setOccupants((prev) => [...prev, {
      id: t.id,
      full_name: t.full_name,
      email: t.email,
      phone: t.phone,
      ssn_last4: t.ssn_last4,
      license_number: t.license_number,
      current_address: t.current_address,
      date_of_birth: t.date_of_birth,
      tenant_id: t.id,
      include: true,
    }]);
    setNewTenantId("");
    setAddingTenant(false);
  }

  async function submit() {
    const includedOccupants = occupants.filter((o) => o.include);
    if (includedOccupants.length === 0) {
      setError("At least one tenant must be included.");
      return;
    }

    setSaving(true);
    setError("");

    const primaryOccupant = includedOccupants[0];
    const coOccupants = includedOccupants.slice(1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Create renewal contract
    const { data: newContract, error: contractErr } = await supabase
      .from("contracts")
      .insert({
        owner_id: user.id,
        property_id: contract.property_id,
        tenant_id: primaryOccupant.tenant_id ?? contract.tenant_id,
        contract_type: contract.contract_type,
        status: "draft",
        unit_number: contract.unit_number,
        lease_start: leaseStart,
        lease_end: leaseEnd,
        lease_months: leaseMonths,
        rent_amount: parseFloat(rentAmount) || contract.rent_amount,
        rent_amount_verbal: contract.rent_amount_verbal,
        security_deposit: parseFloat(securityDeposit) || 0,
        payment_due_day: contract.payment_due_day,
        late_fee_day: contract.late_fee_day,
        late_fee_type: lateFeeType,
        late_fee_grace_period_days: contract.late_fee_grace_period_days,
        late_fee_fixed_amount: parseFloat(lateFeeFixed) || 0,
        late_fee_daily_amount: parseFloat(lateFeeDaily) || 0,
        occupant_count: includedOccupants.length,
        occupant_names: includedOccupants.map((o) => o.full_name),
        key_count: contract.key_count,
        amenities: contract.amenities,
        parent_contract_id: contract.id,
        is_renewal: true,
      })
      .select()
      .single();

    if (contractErr || !newContract) {
      setError(contractErr?.message ?? "Failed to create renewal");
      setSaving(false);
      return;
    }

    // Insert co-occupants with full data for PDF rendering
    if (coOccupants.length > 0) {
      await supabase.from("contract_occupants").insert(
        coOccupants.map((o) => ({
          contract_id: newContract.id,
          owner_id: user.id,
          tenant_id: o.tenant_id,
          role: "co_tenant",
          full_name: o.full_name,
          email: o.email,
          phone: o.phone,
          ssn_last4: o.ssn_last4,
          license_number: o.license_number,
          current_address: o.current_address,
          date_of_birth: o.date_of_birth,
          snapshot: {
            full_name: o.full_name,
            email: o.email,
            phone: o.phone,
            ssn_last4: o.ssn_last4,
            license_number: o.license_number,
            current_address: o.current_address,
            date_of_birth: o.date_of_birth,
          },
        }))
      );
    }

    setSaving(false);
    setOpen(false);
    router.push(`/contracts/${newContract.id}`);
  }

  const lbl = { color: "var(--text-secondary)" } as const;
  const unusedTenants = availableTenants.filter((t) => !occupants.find((o) => o.tenant_id === t.id));

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Renew
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Renew Contract
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {contract.property?.name} · {contract.tenant?.full_name}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-container)" }}
              >
                <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>New Start Date</label>
                <input
                  className="input-tonal"
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Duration (months)</label>
                <input
                  className="input-tonal"
                  type="number"
                  min={1}
                  max={120}
                  value={leaseMonths}
                  onChange={(e) => setLeaseMonths(parseInt(e.target.value) || 12)}
                />
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2.5 text-xs"
              style={{ background: "var(--surface-container)", color: "var(--text-muted)" }}
            >
              New lease end: <span className="font-medium" style={{ color: "var(--text-primary)" }}>{leaseEnd}</span>
            </div>

            {/* Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Monthly Rent ($)</label>
                <input
                  className="input-tonal"
                  type="number"
                  min={0}
                  step={0.01}
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={lbl}>Security Deposit ($)</label>
                <input
                  className="input-tonal"
                  type="number"
                  min={0}
                  step={0.01}
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                />
              </div>
            </div>

            {/* Late fees */}
            <div className="space-y-2">
              <label className="text-xs font-medium" style={lbl}>Late Fee Type</label>
              <div className="flex gap-2">
                {(["fixed", "daily", "both"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="flex-1 rounded-xl py-1.5 text-xs font-medium capitalize"
                    style={{
                      background: lateFeeType === t ? "rgba(0,122,255,0.15)" : "var(--surface-container)",
                      color: lateFeeType === t ? "#007aff" : "var(--text-secondary)",
                      border: `1px solid ${lateFeeType === t ? "rgba(0,122,255,0.30)" : "transparent"}`,
                    }}
                    onClick={() => setLateFeeType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {(lateFeeType === "fixed" || lateFeeType === "both") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Fixed Fee ($)</label>
                  <input className="input-tonal" type="number" min={0} value={lateFeeFixed} onChange={(e) => setLateFeeFixed(e.target.value)} />
                </div>
              )}
              {(lateFeeType === "daily" || lateFeeType === "both") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={lbl}>Daily Fee ($)</label>
                  <input className="input-tonal" type="number" min={0} value={lateFeeDaily} onChange={(e) => setLateFeeDaily(e.target.value)} />
                </div>
              )}
            </div>

            {/* Tenants */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={lbl}>Tenants</label>
                {unusedTenants.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium hover:opacity-70"
                    style={{ color: "#007aff" }}
                    onClick={() => setAddingTenant((v) => !v)}
                  >
                    {addingTenant ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {addingTenant ? "Cancel" : "Add Tenant"}
                  </button>
                )}
              </div>

              {addingTenant && (
                <div className="flex gap-2">
                  <select
                    className="input-tonal flex-1 text-sm"
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                  >
                    <option value="">Select tenant…</option>
                    {unusedTenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                  <button
                    className="btn-primary-gradient px-3"
                    disabled={!newTenantId}
                    onClick={addNewTenant}
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {occupants.map((o) => {
                  const firstIncludedId = occupants.find((x) => x.include)?.id;
                  const isPrimary = o.include && o.id === firstIncludedId;
                  return (
                    <label
                      key={o.id}
                      className="flex items-center gap-3 rounded-xl p-3 cursor-pointer"
                      style={{
                        background: o.include ? "rgba(0,122,255,0.06)" : "var(--surface-container)",
                        border: `1px solid ${o.include ? "rgba(0,122,255,0.20)" : "transparent"}`,
                        opacity: o.include ? 1 : 0.55,
                      }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-[#007aff]"
                        checked={o.include}
                        onChange={() => toggleOccupant(o.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {o.full_name}
                          {isPrimary && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(0,122,255,0.12)", color: "#007aff" }}>
                              Primary
                            </span>
                          )}
                        </p>
                        {o.email && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{o.email}</p>}
                        {o.current_address && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{o.current_address}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary-gradient flex-1 justify-center"
                onClick={submit}
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Renewal Draft
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
