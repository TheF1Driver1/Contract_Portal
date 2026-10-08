"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Minus, Plus, Send } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import type { Contract, ContractOccupant, Tenant } from "@/lib/types";
import SignaturePad from "@/components/SignaturePad";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = ["terms", "details", "sign", "send"] as const;
const LATE_FEE_TYPES = ["fixed", "daily", "both"] as const;

/** Four-step renewal wizard: terms → details → signatures → send. */
export default function RenewalModal({ contract, availableTenants, open, onOpenChange }: Props) {
  const t = useTranslations("contracts.renewal");
  const tc = useTranslations("common");
  const f = useFormatter();
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

  // ── Step 4: Send ────────────────────────────────────────
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
      setError(t("errNoTenant"));
      return;
    }
    setError("");
    setStep(1);
  }

  async function finalize() {
    const includedOccupants = occupants.filter((o) => o.include);
    const primaryOccupant = includedOccupants[0];
    const coTenants = includedOccupants.slice(1);

    // Tenants sign the renewal through the verified e-sign flow (Plan 31);
    // only the landlord's own signature is captured here.

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
        status: "draft",
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
        landlord_signature: landlordSig || null,
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
      setError(contractErr?.message ?? t("errCreate"));
      toast.error(t("errCreate"), { description: contractErr?.message });
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
          signature: null,
          signed_at: null,
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
    toast.success(t("created"));
  }

  async function handleSend() {
    setSaving(true);
    const res = await fetch(`/api/contracts/${newContractId}/signers`, { method: "POST" }).catch(() => null);
    if (res?.ok) toast.success(t("sendDone"));
    else {
      const json = await res?.json().catch(() => ({}));
      toast.error(t("sendFailed"), { description: typeof json?.error === "string" ? json.error : undefined });
    }
    setSaving(false);
    onOpenChange(false);
    router.push(`/contracts/${newContractId}`);
  }

  const unusedTenants = availableTenants.filter((x) => !occupants.find((o) => o.tenant_id === x.id));
  const includedOccupants = occupants.filter((o) => o.include);

  // The sheet can't be dismissed once the renewal is saved (step 3); use Skip or Send.
  function handleOpenChange(next: boolean) {
    if (!next && step === 3) return;
    if (!next) {
      setStep(0);
      setError("");
    }
    onOpenChange(next);
  }

  const amenityToggle = (id: string, label: string, value: boolean, onChange: (v: boolean) => void) => (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-lg border px-3 py-2",
        value ? "border-border-strong bg-primary-soft" : "bg-surface"
      )}
    >
      <Checkbox id={`renew-${id}`} checked={value} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={`renew-${id}`} className="flex-1 cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );

  const numberField = (id: string, label: string, value: number, onChange: (v: number) => void, min = 0) => (
    <div className="space-y-1.5">
      <Label htmlFor={`renew-${id}`}>{label}</Label>
      <Input
        id={`renew-${id}`}
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="tabular"
      />
    </div>
  );

  const errorBox = error ? (
    <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-danger">
      {error}
    </p>
  ) : null;

  let footer: ReactNode = null;
  if (step === 0) {
    footer = (
      <>
        <Button variant="outline" onClick={() => handleOpenChange(false)}>
          {tc("cancel")}
        </Button>
        <Button onClick={goToStep1}>
          {t("continue")}
          <ArrowRight />
        </Button>
      </>
    );
  } else if (step === 1) {
    footer = (
      <>
        <Button variant="outline" onClick={() => setStep(0)}>
          <ArrowLeft />
          {tc("back")}
        </Button>
        <Button onClick={() => setStep(2)}>
          {t("continue")}
          <ArrowRight />
        </Button>
      </>
    );
  } else if (step === 2) {
    footer = (
      <>
        <Button
          variant="outline"
          onClick={() => {
            setError("");
            setStep(1);
          }}
        >
          <ArrowLeft />
          {tc("back")}
        </Button>
        <Button onClick={finalize} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />}
          {t("finalize")}
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
            router.push(`/contracts/${newContractId}`);
          }}
        >
          {t("skip")}
        </Button>
        <Button onClick={handleSend} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Send />}
          {t("sendContract")}
        </Button>
      </>
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      wide
      title={t("title")}
      description={[contract.property?.name, contract.tenant?.full_name].filter(Boolean).join(" · ")}
      footer={footer}
    >
      <div className="space-y-6">
        {/* Step indicator */}
        <ol className="flex items-center gap-2" aria-label={t("stepsLabel")}>
          {STEPS.map((key, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={key} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? "step" : undefined}>
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                      done && "border-transparent bg-success-soft text-success",
                      active && "border-primary bg-primary-soft text-primary-soft-foreground",
                      !done && !active && "bg-surface-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("text-xs", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {t(`steps.${key}`)}
                  </span>
                </span>
                {i < STEPS.length - 1 && (
                  <span className={cn("mb-5 h-px flex-1", i < step ? "bg-success" : "bg-border")} aria-hidden />
                )}
              </li>
            );
          })}
        </ol>

        {/* ── STEP 0: Terms ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="renew-start">{t("startDate")}</Label>
                <Input id="renew-start" type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renew-months">{t("months")}</Label>
                <Input
                  id="renew-months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  value={leaseMonths}
                  onChange={(e) => setLeaseMonths(parseInt(e.target.value) || 12)}
                  className="tabular"
                />
              </div>
            </div>
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
              {t("newEnd")}{" "}
              <span className="font-medium text-foreground">
                {f.dateTime(new Date(`${leaseEnd}T12:00:00`), { dateStyle: "medium" })}
              </span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="renew-rent">{t("rent")}</Label>
                <Input
                  id="renew-rent"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                  className="tabular"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renew-deposit">{t("deposit")}</Label>
                <Input
                  id="renew-deposit"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  className="tabular"
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("lateFeeType")}</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {LATE_FEE_TYPES.map((x) => (
                  <Button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={lateFeeType === x}
                    variant={lateFeeType === x ? "secondary" : "outline"}
                    className={cn(lateFeeType === x && "border border-primary bg-primary-soft text-primary-soft-foreground")}
                    onClick={() => setLateFeeType(x)}
                  >
                    {t(`lateFee.${x}`)}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(lateFeeType === "fixed" || lateFeeType === "both") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="renew-fee-fixed">{t("fixedFee")}</Label>
                    <Input id="renew-fee-fixed" type="number" inputMode="decimal" min={0} value={lateFeeFixed} onChange={(e) => setLateFeeFixed(e.target.value)} className="tabular" />
                  </div>
                )}
                {(lateFeeType === "daily" || lateFeeType === "both") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="renew-fee-daily">{t("dailyFee")}</Label>
                    <Input id="renew-fee-daily" type="number" inputMode="decimal" min={0} value={lateFeeDaily} onChange={(e) => setLateFeeDaily(e.target.value)} className="tabular" />
                  </div>
                )}
              </div>
            </fieldset>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t("tenants")}</h3>
                {unusedTenants.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setAddingTenant((v) => !v)}>
                    {addingTenant ? <Minus /> : <Plus />}
                    {addingTenant ? tc("cancel") : t("addTenant")}
                  </Button>
                )}
              </div>

              {addingTenant && (
                <div className="flex gap-2">
                  <Select value={newTenantId} onValueChange={setNewTenantId}>
                    <SelectTrigger className="flex-1" aria-label={t("selectTenant")}>
                      <SelectValue placeholder={t("selectTenant")} />
                    </SelectTrigger>
                    <SelectContent>
                      {unusedTenants.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button disabled={!newTenantId} onClick={addNewTenant}>
                    {tc("add")}
                  </Button>
                </div>
              )}

              <ul className="space-y-2">
                {occupants.map((o) => {
                  const firstIncludedId = occupants.find((x) => x.include)?.id;
                  const isPrimary = o.include && o.id === firstIncludedId;
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        o.include ? "border-border-strong bg-primary-soft" : "bg-surface-muted opacity-70"
                      )}
                    >
                      <Checkbox id={`renew-occ-${o.id}`} checked={o.include} onCheckedChange={() => toggleOccupant(o.id)} />
                      <Label htmlFor={`renew-occ-${o.id}`} className="block min-w-0 flex-1 cursor-pointer font-normal">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {o.full_name}
                          {isPrimary && (
                            <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-semibold text-primary">
                              {t("primary")}
                            </span>
                          )}
                        </span>
                        {o.email && <span className="block text-xs text-muted-foreground">{o.email}</span>}
                        {o.current_address && <span className="block text-xs text-muted-foreground">{o.current_address}</span>}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {errorBox}
          </div>
        )}

        {/* ── STEP 1: Details ── */}
        {step === 1 && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("unitCounts")}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="renew-unit">{t("unit")}</Label>
                  <Input id="renew-unit" type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder={t("unitPlaceholder")} />
                </div>
                {numberField("rooms", t("bedrooms"), roomCount, setRoomCount)}
                {numberField("fans", t("fans"), fanCount, setFanCount)}
                {numberField("stools", t("stools"), stoolCount, setStoolCount)}
                {numberField("stoves", t("stoves"), stoveCount, setStoveCount)}
                {numberField("keys", t("keys"), keyCount, setKeyCount, 1)}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("amenities")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {amenityToggle("ac", t("amenity.ac"), hasAC, setHasAC)}
                {amenityToggle("fridge", t("amenity.fridge"), hasFridge, setHasFridge)}
                {amenityToggle("microwave", t("amenity.microwave"), hasMicrowave, setHasMicrowave)}
                {amenityToggle("sofa", t("amenity.sofa"), hasSofa, setHasSofa)}
                {amenityToggle("futon", t("amenity.futon"), hasFuton, setHasFuton)}
                {amenityToggle("blinds", t("amenity.mini_blinds"), hasMiniBlinds, setHasMiniBlinds)}
                {amenityToggle("mirror", t("amenity.mirror_doors"), hasMirrorDoors, setHasMirrorDoors)}
                {amenityToggle("bath", t("amenity.renovated_bathroom"), hasRenovatedBath, setHasRenovatedBath)}
                {amenityToggle("art", t("amenity.wall_art"), hasWallArt, setHasWallArt)}
                {amenityToggle("parking", t("amenity.parking"), hasParking, setHasParking)}
              </div>
              {hasParking && (
                <div className="space-y-1.5">
                  <Label htmlFor="renew-spot">{t("parkingSpot")}</Label>
                  <Input id="renew-spot" type="text" value={parkingSpot} onChange={(e) => setParkingSpot(e.target.value)} placeholder={t("parkingPlaceholder")} />
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── STEP 2: Sign ── */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("signHint")}</p>
            <SignaturePad label={t("landlordSignature")} value={landlordSig} onChange={setLandlordSig} />
            {errorBox}
          </div>
        )}

        {/* ── STEP 3: Send ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              {t("createdBanner")}
            </p>
            <p className="text-sm text-muted-foreground">{t("sendHint")}</p>
            {errorBox}
          </div>
        )}
      </div>
    </FormSheet>
  );
}
