"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { RefreshCw, X, Loader2, Plus, Minus, Check } from "lucide-react";
import type { Contract, ContractOccupant, Tenant } from "@/lib/types";
import SignaturePad from "@/components/SignaturePad";

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

const STEPS = ["Terms", "Details", "Sign", "Send"] as const;

export default function RenewalModal({ contract, availableTenants }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const router = useRouter();
  const supabase = createBrowserClient();

  // ── Step 1: Terms ───────────────────────────────────────
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

  const [addingTenant, setAddingTenant] = useState(false);
  const [newTenantId, setNewTenantId] = useState("");

  // ── Step 2: Details ─────────────────────────────────────
  const [unitNumber, setUnitNumber] = useState(contract.unit_number ?? "");
  const [roomCount, setRoomCount] = useState(Number(contract.amenities?.room_count ?? 2));
  const [fanCount, setFanCount] = useState(Number(contract.amenities?.fan_count ?? 0));
  const [stoolCount, setStoolCount] = useState(Number(contract.amenities?.stool_count ?? 0));
  const [stoveCount, setStoveCount] = useState(Number(contract.amenities?.stove_count ?? 1));
  const [keyCount, setKeyCount] = useState(Number(contract.amenities?.key_count ?? contract.key_count ?? 2));
  const [hasAC, setHasAC] = useState(Boolean(contract.amenities?.ac));
  const [hasFridge, setHasFridge] = useState(Boolean(contract.amenities?.fridge));
  const [hasMicrowave, setHasMicrowave] = useState(Boolean(contract.amenities?.microwave));
  const [hasSofa, setHasSofa] = useState(Boolean(contract.amenities?.sofa));
  const [hasFuton, setHasFuton] = useState(Boolean(contract.amenities?.futon));
  const [hasMiniBlinds, setHasMiniBlinds] = useState(Boolean(contract.amenities?.mini_blinds));
  const [hasMirrorDoors, setHasMirrorDoors] = useState(Boolean(contract.amenities?.mirror_doors));
  const [hasRenovatedBath, setHasRenovatedBath] = useState(Boolean(contract.amenities?.renovated_bathroom));
  const [hasWallArt, setHasWallArt] = useState(Boolean(contract.amenities?.wall_art));
  const [hasParking, setHasParking] = useState(Boolean(contract.amenities?.parking));
  const [parkingSpot, setParkingSpot] = useState(String(contract.amenities?.parking_spot ?? ""));

  // ── Step 3: Signatures ──────────────────────────────────
  const [landlordSig, setLandlordSig] = useState("");
  const [tenantSig, setTenantSig] = useState("");
  const [coTenantSigs, setCoTenantSigs] = useState<string[]>([]);

  // ── Step 4: Send ────────────────────────────────────────
  const [sendEmail, setSendEmail] = useState(contract.tenant?.email ?? "");
  const [sendPhone, setSendPhone] = useState(contract.tenant?.phone ?? "");
  const [newContractId, setNewContractId] = useState<string | null>(null);

  // ── Shared ──────────────────────────────────────────────
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

  function goToStep1() {
    const included = occupants.filter((o) => o.include);
    if (included.length === 0) {
      setError("At least one tenant must be included.");
      return;
    }
    setError("");
    const coCount = included.slice(1).length;
    setCoTenantSigs((prev) => {
      const next = Array(coCount).fill("");
      for (let i = 0; i < Math.min(prev.length, coCount); i++) next[i] = prev[i];
      return next;
    });
    setStep(1);
  }

  async function finalize() {
    const includedOccupants = occupants.filter((o) => o.include);
    const primaryOccupant = includedOccupants[0];
    const coTenants = includedOccupants.slice(1);

    const missing: string[] = [];
    if (!landlordSig) missing.push("Landlord");
    if (!tenantSig) missing.push(primaryOccupant.full_name);
    coTenants.forEach((o, i) => { if (!coTenantSigs[i]) missing.push(o.full_name); });
    if (missing.length > 0) {
      setError(`Missing signatures: ${missing.join(", ")}`);
      return;
    }

    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: newContract, error: contractErr } = await supabase
      .from("contracts")
      .insert({
        owner_id: user.id,
        property_id: contract.property_id,
        tenant_id: primaryOccupant.tenant_id ?? contract.tenant_id,
        contract_type: contract.contract_type,
        status: "signed",
        unit_number: unitNumber || contract.unit_number,
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
        key_count: keyCount,
        amenities: {
          room_count: roomCount,
          fan_count: fanCount,
          stool_count: stoolCount,
          stove_count: stoveCount,
          mirror_doors: hasMirrorDoors,
          renovated_bathroom: hasRenovatedBath,
          microwave: hasMicrowave,
          fridge: hasFridge,
          ac: hasAC,
          mini_blinds: hasMiniBlinds,
          sofa: hasSofa,
          futon: hasFuton,
          wall_art: hasWallArt,
          parking: hasParking,
          parking_spot: parkingSpot || null,
        },
        parent_contract_id: contract.id,
        is_renewal: true,
        landlord_signature: landlordSig,
        tenant_signature: tenantSig,
        signed_at: new Date().toISOString(),
        tenant_snapshot: {
          full_name: primaryOccupant.full_name,
          email: primaryOccupant.email,
          phone: primaryOccupant.phone,
          ssn_last4: primaryOccupant.ssn_last4,
          license_number: primaryOccupant.license_number,
          current_address: primaryOccupant.current_address,
          date_of_birth: primaryOccupant.date_of_birth,
        },
        property_snapshot: contract.property_snapshot ?? null,
      })
      .select()
      .single();

    if (contractErr || !newContract) {
      setError(contractErr?.message ?? "Failed to create renewal");
      setSaving(false);
      return;
    }

    if (coTenants.length > 0) {
      await supabase.from("contract_occupants").insert(
        coTenants.map((o, i) => ({
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
          signature: coTenantSigs[i] || null,
          signed_at: coTenantSigs[i] ? new Date().toISOString() : null,
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

    setNewContractId(newContract.id);
    setSaving(false);
    setStep(3);
  }

  async function handleSend() {
    setSaving(true);
    await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: newContractId,
        ...(sendEmail ? { landlordEmail: sendEmail } : {}),
        ...(sendPhone ? { phone: sendPhone } : {}),
      }),
    });
    setSaving(false);
    setOpen(false);
    router.push(`/contracts/${newContractId}`);
  }

  const lbl = { color: "var(--text-secondary)" } as const;
  const unusedTenants = availableTenants.filter((t) => !occupants.find((o) => o.tenant_id === t.id));
  const includedOccupants = occupants.filter((o) => o.include);
  const includedCoTenants = includedOccupants.slice(1);

  const amenityToggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <label
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer"
      style={{
        background: value ? "rgba(16, 185, 129,0.06)" : "var(--surface-container)",
        border: `1px solid ${value ? "rgba(16, 185, 129,0.20)" : "transparent"}`,
      }}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded accent-[#10b981]"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm" style={{ color: value ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {label}
      </span>
    </label>
  );

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
        onClick={() => { setStep(0); setError(""); setOpen(true); }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Renew
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => step < 3 && setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-5"
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
              {step < 3 && (
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "var(--surface-container)" }}
                >
                  <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                </button>
              )}
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0">
              {STEPS.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                        style={{
                          background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(16, 185, 129,0.15)" : "var(--surface-container)",
                          color: done ? "#22c55e" : active ? "#10b981" : "var(--text-muted)",
                          border: `1.5px solid ${done ? "rgba(34,197,94,0.35)" : active ? "rgba(16, 185, 129,0.35)" : "transparent"}`,
                        }}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className="flex-1 h-px mx-2 mb-4"
                        style={{ background: i < step ? "rgba(34,197,94,0.35)" : "var(--surface-container)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── STEP 0: Terms ── */}
            {step === 0 && (
              <>
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

                <div className="space-y-2">
                  <label className="text-xs font-medium" style={lbl}>Late Fee Type</label>
                  <div className="flex gap-2">
                    {(["fixed", "daily", "both"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="flex-1 rounded-xl py-1.5 text-xs font-medium capitalize"
                        style={{
                          background: lateFeeType === t ? "rgba(16, 185, 129,0.15)" : "var(--surface-container)",
                          color: lateFeeType === t ? "#10b981" : "var(--text-secondary)",
                          border: `1px solid ${lateFeeType === t ? "rgba(16, 185, 129,0.30)" : "transparent"}`,
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium" style={lbl}>Tenants</label>
                    {unusedTenants.length > 0 && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-medium hover:opacity-70"
                        style={{ color: "#10b981" }}
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
                            background: o.include ? "rgba(16, 185, 129,0.06)" : "var(--surface-container)",
                            border: `1px solid ${o.include ? "rgba(16, 185, 129,0.20)" : "transparent"}`,
                            opacity: o.include ? 1 : 0.55,
                          }}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-[#10b981]"
                            checked={o.include}
                            onChange={() => toggleOccupant(o.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {o.full_name}
                              {isPrimary && (
                                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(16, 185, 129,0.12)", color: "#10b981" }}>
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
                  <button className="btn-primary-gradient flex-1 justify-center" onClick={goToStep1}>
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 1: Details ── */}
            {step === 1 && (
              <>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>UNIT & COUNTS</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Unit #</label>
                        <input
                          className="input-tonal"
                          type="text"
                          value={unitNumber}
                          onChange={(e) => setUnitNumber(e.target.value)}
                          placeholder="e.g. 2B"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Bedrooms</label>
                        <input className="input-tonal" type="number" min={0} value={roomCount} onChange={(e) => setRoomCount(parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Ceiling Fans</label>
                        <input className="input-tonal" type="number" min={0} value={fanCount} onChange={(e) => setFanCount(parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Bar Stools</label>
                        <input className="input-tonal" type="number" min={0} value={stoolCount} onChange={(e) => setStoolCount(parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Stoves</label>
                        <input className="input-tonal" type="number" min={0} value={stoveCount} onChange={(e) => setStoveCount(parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Keys</label>
                        <input className="input-tonal" type="number" min={1} value={keyCount} onChange={(e) => setKeyCount(parseInt(e.target.value) || 1)} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>AMENITIES INCLUDED</p>
                    <div className="grid grid-cols-2 gap-2">
                      {amenityToggle("Air Conditioning", hasAC, setHasAC)}
                      {amenityToggle("Refrigerator", hasFridge, setHasFridge)}
                      {amenityToggle("Microwave", hasMicrowave, setHasMicrowave)}
                      {amenityToggle("Sofa", hasSofa, setHasSofa)}
                      {amenityToggle("Futon", hasFuton, setHasFuton)}
                      {amenityToggle("Mini Blinds", hasMiniBlinds, setHasMiniBlinds)}
                      {amenityToggle("Mirror Closet Doors", hasMirrorDoors, setHasMirrorDoors)}
                      {amenityToggle("Renovated Bathroom", hasRenovatedBath, setHasRenovatedBath)}
                      {amenityToggle("Wall Art", hasWallArt, setHasWallArt)}
                      {amenityToggle("Parking Included", hasParking, setHasParking)}
                    </div>
                    {hasParking && (
                      <div className="mt-2 space-y-1.5">
                        <label className="text-xs font-medium" style={lbl}>Parking Spot ID</label>
                        <input
                          className="input-tonal"
                          type="text"
                          value={parkingSpot}
                          onChange={(e) => setParkingSpot(e.target.value)}
                          placeholder="e.g. A-12"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => setStep(0)}>
                    ← Back
                  </button>
                  <button className="btn-primary-gradient flex-1 justify-center" onClick={() => setStep(2)}>
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: Sign ── */}
            {step === 2 && (
              <>
                <div className="space-y-5">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    All parties must sign before the renewal contract is created.
                  </p>

                  <SignaturePad
                    label="Landlord Signature"
                    value={landlordSig}
                    onChange={setLandlordSig}
                  />

                  {includedOccupants[0] && (
                    <>
                      <div className="border-t" style={{ borderColor: "var(--surface-container)" }} />
                      <SignaturePad
                        label={`Tenant — ${includedOccupants[0].full_name}`}
                        value={tenantSig}
                        onChange={setTenantSig}
                      />
                    </>
                  )}

                  {includedCoTenants.map((o, i) => (
                    <div key={o.id}>
                      <div className="border-t mb-5" style={{ borderColor: "var(--surface-container)" }} />
                      <SignaturePad
                        label={`Co-Tenant — ${o.full_name}`}
                        value={coTenantSigs[i] ?? ""}
                        onChange={(v) =>
                          setCoTenantSigs((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" className="btn-tonal flex-1 justify-center" onClick={() => { setError(""); setStep(1); }}>
                    ← Back
                  </button>
                  <button
                    className="btn-primary-gradient flex-1 justify-center"
                    onClick={finalize}
                    disabled={saving}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Save & Finalize
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3: Send ── */}
            {step === 3 && (
              <>
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)", color: "#22c55e" }}
                >
                  Contract created and signed successfully.
                </div>

                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Send the signed contract to the tenant via email.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={lbl}>Tenant Email</label>
                    <input
                      className="input-tonal"
                      type="email"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      placeholder="tenant@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={lbl}>Phone (optional, for SMS)</label>
                    <input
                      className="input-tonal"
                      type="tel"
                      value={sendPhone}
                      onChange={(e) => setSendPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="btn-tonal flex-1 justify-center"
                    onClick={() => { setOpen(false); router.push(`/contracts/${newContractId}`); }}
                  >
                    Skip
                  </button>
                  <button
                    className="btn-primary-gradient flex-1 justify-center"
                    onClick={handleSend}
                    disabled={saving || !sendEmail}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Send Contract →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
