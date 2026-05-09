"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SignaturePad from "@/components/SignaturePad";
import { createClient } from "@/lib/supabase";
import type { Property, Tenant, ContractFormValues, ContractTemplate } from "@/lib/types";
import { Loader2, Download, Send, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractBuilderProps {
  properties: Property[];
  tenants: Tenant[];
  templates: ContractTemplate[];
  userId: string;
  landlordEmail: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
      <label
        className="text-xs font-medium block mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
      <div className="rounded-2xl p-4 space-y-4" style={{ background: "var(--surface-low)" }}>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </p>
        {children}
      </div>
  );
}

const STEPS = [
  { id: 0, label: "Details" },
  { id: 1, label: "Property" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Signatures" },
  { id: 4, label: "Send" },
];

export default function ContractBuilder({
  properties,
  tenants,
  templates,
  userId,
  landlordEmail,
}: ContractBuilderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [landlordEmailInput, setLandlordEmailInput] = useState(landlordEmail);
  const [additionalTenantIds, setAdditionalTenantIds] = useState<string[]>([]);
  const [coTenantSignatures, setCoTenantSignatures] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<ContractFormValues>({
    defaultValues: {
      contract_type: "lease",
      property_id: "",
      unit_number: "",
      tenant_id: "",
      lease_start: "",
      lease_end: "",
      lease_months: 12,
      rent_amount: 0,
      rent_amount_verbal: "",
      security_deposit: 0,
      payment_due_day: 1,
      late_fee_day: 5,
      occupant_names: "",
      occupant_count: 1,
      room_count: 2,
      fan_count: 2,
      stool_count: 2,
      stove_count: 1,
      key_count: 2,
      mirror_doors: false,
      renovated_bathroom: false,
      microwave: false,
      fridge: true,
      ac: false,
      mini_blinds: false,
      sofa: false,
      futon: false,
      wall_art: false,
      parking: false,
      bathroom_count: 1,
      parking_available: false,
      parking_count: 0,
      parking_spot: "",
      late_fee_type: "fixed" as const,
      late_fee_grace_period_days: 0,
      late_fee_fixed_amount: 0,
      late_fee_daily_amount: 0,
      template_id: "",
      landlord_signature: "",
      tenant_signature: "",
      send_email: false,
      send_sms: false,
      recipient_email: "",
      recipient_phone: "",
    },
  });

  const values = watch();

  useEffect(() => {
    if (!values.lease_start || !values.lease_months) return;
    const start = new Date(values.lease_start);
    start.setMonth(start.getMonth() + Number(values.lease_months));
    setValue("lease_end", start.toISOString().split("T")[0], { shouldValidate: true });
  }, [values.lease_start, values.lease_months]);

  useEffect(() => {
    if (!values.property_id) return;
    const prop = properties.find((p) => p.id === values.property_id);
    if (!prop) return;
    setValue("bathroom_count", prop.bathroom_count ?? 1);
    setValue("parking_available", prop.parking_available ?? false);
    setValue("parking_count", prop.parking_count ?? 0);
  }, [values.property_id]);

  async function saveDraft(data: ContractFormValues) {
    setLoading(true);
    try {
      const amenities = {
        room_count: data.room_count,
        fan_count: data.fan_count,
        stool_count: data.stool_count,
        stove_count: data.stove_count,
        mirror_doors: data.mirror_doors,
        renovated_bathroom: data.renovated_bathroom,
        microwave: data.microwave,
        fridge: data.fridge,
        ac: data.ac,
        mini_blinds: data.mini_blinds,
        sofa: data.sofa,
        futon: data.futon,
        wall_art: data.wall_art,
        parking: data.parking_available,
        parking_spot: data.parking_spot || null,
      };

      const payload = {
        owner_id: userId,
        property_id: data.property_id,
        tenant_id: data.tenant_id,
        contract_type: data.contract_type,
        status: "draft" as const,
        unit_number: data.unit_number || null,
        lease_start: data.lease_start || null,
        lease_end: data.lease_end || null,
        lease_months: data.lease_months,
        rent_amount: data.rent_amount,
        rent_amount_verbal: data.rent_amount_verbal || null,
        security_deposit: data.security_deposit,
        payment_due_day: data.payment_due_day,
        late_fee_day: data.late_fee_day,
        occupant_names: data.occupant_names
          ? data.occupant_names.split(",").map((s) => s.trim())
          : [],
        occupant_count: data.occupant_count,
        amenities,
        key_count: data.key_count,
        template_id: data.template_id || null,
        landlord_signature: data.landlord_signature || null,
        tenant_signature: data.tenant_signature || null,
        signed_at:
          data.landlord_signature &&
          data.tenant_signature &&
          additionalTenantIds.filter(Boolean).every((_, i) => !!coTenantSignatures[i])
            ? new Date().toISOString()
            : null,
        late_fee_type: data.late_fee_type,
        late_fee_grace_period_days: data.late_fee_grace_period_days,
        late_fee_fixed_amount: data.late_fee_fixed_amount,
        late_fee_daily_amount: data.late_fee_daily_amount,
      };

      let contractId = savedId;
      if (contractId) {
        const { error } = await supabase
          .from("contracts")
          .update(payload)
          .eq("id", contractId);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("contracts")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        contractId = created.id;
        setSavedId(contractId);
      }

      // Write immutable snapshots for legal accuracy
      const selectedProperty = properties.find((p) => p.id === data.property_id);
      const selectedTenant   = tenants.find((t) => t.id === data.tenant_id);
      if (selectedProperty || selectedTenant) {
        await supabase.from("contracts").update({
          property_snapshot: selectedProperty ? {
            name: selectedProperty.name,
            address: selectedProperty.address,
            unit: selectedProperty.unit ?? null,
            city: selectedProperty.city,
            state: selectedProperty.state,
            zip: selectedProperty.zip ?? null,
            country: selectedProperty.country ?? null,
            unit_count: selectedProperty.unit_count,
            bathroom_count: selectedProperty.bathroom_count ?? data.bathroom_count,
            parking_available: selectedProperty.parking_available ?? data.parking_available,
            parking_count: selectedProperty.parking_count ?? null,
          } : null,
          tenant_snapshot: selectedTenant ? {
            full_name: selectedTenant.full_name,
            email: selectedTenant.email ?? null,
            phone: selectedTenant.phone ?? null,
            ssn_last4: selectedTenant.ssn_last4 ?? null,
            license_number: selectedTenant.license_number ?? null,
            current_address: selectedTenant.current_address ?? null,
            date_of_birth: selectedTenant.date_of_birth ?? null,
            employer_name: selectedTenant.employer_name ?? null,
            employer_phone: selectedTenant.employer_phone ?? null,
            monthly_income: selectedTenant.monthly_income ?? null,
            emergency_contact_name: selectedTenant.emergency_contact_name ?? null,
            emergency_contact_phone: selectedTenant.emergency_contact_phone ?? null,
          } : null,
        }).eq("id", contractId!);
      }

      // Sync co-tenants to contract_occupants (clean slate then re-insert)
      await supabase
        .from("contract_occupants")
        .delete()
        .eq("contract_id", contractId!)
        .eq("role", "co_tenant");

      const validCoTenants = additionalTenantIds.filter(Boolean);
      if (validCoTenants.length > 0) {
        const occupantRows = validCoTenants.map((tid, i) => {
          const t = tenants.find((t) => t.id === tid);
          if (!t) return null;
          const sig = coTenantSignatures[i] || null;
          return {
            contract_id: contractId!,
            owner_id: userId,
            role: "co_tenant" as const,
            tenant_id: tid,
            full_name: t.full_name,
            email: t.email ?? null,
            phone: t.phone ?? null,
            ssn_last4: t.ssn_last4 ?? null,
            license_number: t.license_number ?? null,
            current_address: t.current_address ?? null,
            date_of_birth: t.date_of_birth ?? null,
            signature: sig,
            signed_at: sig ? new Date().toISOString() : null,
            snapshot: {
              full_name: t.full_name,
              email: t.email ?? null,
              phone: t.phone ?? null,
              ssn_last4: t.ssn_last4 ?? null,
              license_number: t.license_number ?? null,
              current_address: t.current_address ?? null,
              date_of_birth: t.date_of_birth ?? null,
              employer_name: t.employer_name ?? null,
              employer_phone: t.employer_phone ?? null,
              monthly_income: t.monthly_income ?? null,
              emergency_contact_name: t.emergency_contact_name ?? null,
              emergency_contact_phone: t.emergency_contact_phone ?? null,
            },
          };
        }).filter(Boolean);
        if (occupantRows.length > 0) {
          await supabase.from("contract_occupants").insert(occupantRows);
        }
      }

      return contractId!;
    } finally {
      setLoading(false);
    }
  }

  async function generateAndDownload(data: ContractFormValues, format: "pdf" | "docx" = "pdf") {
    const contractId = await saveDraft(data);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, format }),
      });
      if (!res.ok) throw new Error(await res.text());
      const contentType = res.headers.get("content-type") ?? "";
      const ext = contentType.includes("pdf") ? "pdf" : "docx";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contractId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  async function generateAndStore(contractId: string): Promise<string | null> {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, format: "pdf", store: true }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      return result.pdf_url ?? null;
    } catch {
      return null;
    }
  }

  async function sendContract(data: ContractFormValues) {
    const contractId = await saveDraft(data);
    setGenerating(true);
    try {
      await generateAndStore(contractId);
    } finally {
      setGenerating(false);
    }
    setLoading(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          ...(landlordEmailInput ? { landlordEmail: landlordEmailInput } : {}),
          ...(data.send_sms && data.recipient_phone ? { phone: data.recipient_phone } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.results?.email && result.results.email !== "sent") {
        console.warn("[send] email result:", result.results.email);
        alert(`Contract saved. Email issue: ${result.results.email}`);
      }
      router.push(`/contracts/${contractId}`);
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Step progress strip ── */}
      <div className="flex items-center gap-0 animate-slide-up">
        {STEPS.map((s, i) => (
          <Fragment key={s.id}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300",
                  step > i
                    ? "text-white"
                    : step === i
                    ? "text-white ring-4"
                    : ""
                )}
                style={{
                  background:
                    step > i || step === i
                      ? "linear-gradient(135deg, #005bc2, #007aff)"
                      : "var(--surface-container)",
                  boxShadow:
                    step === i ? "0 0 0 4px rgba(0,122,255,0.18)" : "none",
                  color:
                    step > i || step === i
                      ? "white"
                      : "var(--text-muted)",
                }}
              >
                {step > i ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className="text-[10px] font-medium hidden sm:block"
                style={{
                  color: step === i ? "#007aff" : "var(--text-muted)",
                }}
              >
                {s.label}
              </span>
            </button>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4 transition-all duration-300"
                style={{
                  background:
                    step > i ? "#007aff" : "var(--surface-container)",
                }}
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* Mobile step label */}
      <p
        className="sm:hidden text-sm font-medium animate-slide-up"
        style={{ color: "var(--text-secondary)", animationDelay: "0.05s", animationFillMode: "both" }}
      >
        Step {step + 1} of {STEPS.length}: {STEPS[step].label}
      </p>

      <form onSubmit={handleSubmit(sendContract)}>
        {/* ── Step 0: Contract Details ── */}
        {step === 0 && (
          <div
            className="surface-card p-6 space-y-5 animate-scale-in"
          >
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Contract Details
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Choose contract type and assign a tenant
              </p>
            </div>

            <Section title="Contract">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Contract Type</FieldLabel>
                  <Controller
                    control={control}
                    name="contract_type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="input-tonal border-none h-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lease">Lease Agreement</SelectItem>
                          <SelectItem value="rental">Rental Agreement</SelectItem>
                          <SelectItem value="addendum">Addendum</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <FieldLabel>Tenant *</FieldLabel>
                  <Controller
                    control={control}
                    name="tenant_id"
                    rules={{ required: "Tenant is required" }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="input-tonal border-none h-auto">
                          <SelectValue placeholder="Select tenant…" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.tenant_id && <p className="text-xs text-destructive mt-1">{errors.tenant_id.message}</p>}
                </div>
              </div>
            </Section>

            <Section title="Co-Tenants">
              <div className="space-y-3">
                {additionalTenantIds.map((tid, i) => {
                  const taken = new Set([values.tenant_id, ...additionalTenantIds.filter((_, j) => j !== i)]);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={tid}
                          onValueChange={(v) => {
                            const next = [...additionalTenantIds];
                            next[i] = v;
                            setAdditionalTenantIds(next);
                            const sigs = [...coTenantSignatures];
                            sigs[i] = "";
                            setCoTenantSignatures(sigs);
                          }}
                        >
                          <SelectTrigger className="input-tonal border-none h-auto">
                            <SelectValue placeholder="Select co-tenant…" />
                          </SelectTrigger>
                          <SelectContent>
                            {tenants.filter((t) => !taken.has(t.id)).map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdditionalTenantIds((ids) => ids.filter((_, j) => j !== i));
                          setCoTenantSignatures((sigs) => sigs.filter((_, j) => j !== i));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-colors"
                        style={{ background: "var(--surface-container)" }}
                      >
                        <X className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                      </button>
                    </div>
                  );
                })}
                {additionalTenantIds.length < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdditionalTenantIds((ids) => [...ids, ""]);
                      setCoTenantSignatures((sigs) => [...sigs, ""]);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: "#007aff" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Co-Tenant
                  </button>
                )}
              </div>
            </Section>

            {templates.length > 0 && (
              <Section title="Template">
                <div>
                  <FieldLabel>Contract Template</FieldLabel>
                  <Controller
                    control={control}
                    name="template_id"
                    render={({ field }) => (
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        value={field.value || "__none__"}
                      >
                        <SelectTrigger className="input-tonal border-none h-auto">
                          <SelectValue placeholder="Use default template…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Default template</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                              {t.is_default ? " ★" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                    Manage templates in{" "}
                    <a href="/settings/templates" className="underline" style={{ color: "#007aff" }}>
                      Settings → Templates
                    </a>
                  </p>
                </div>
              </Section>
            )}

            <Section title="Lease Period">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>Start Date *</FieldLabel>
                  <input
                    className="input-tonal"
                    type="date"
                    data-empty={!values.lease_start || undefined}
                    {...register("lease_start", { required: "Start date is required" })}
                  />
                  {errors.lease_start && <p className="text-xs text-destructive mt-1">{errors.lease_start.message}</p>}
                </div>
                <div>
                  <FieldLabel>End Date *</FieldLabel>
                  <input
                    className="input-tonal"
                    type="date"
                    data-empty={!values.lease_end || undefined}
                    {...register("lease_end", { required: true })}
                  />
                </div>
                <div>
                  <FieldLabel>Duration (months)</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    {...register("lease_months", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Occupants">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Names (comma-separated)</FieldLabel>
                  <input
                    className="input-tonal"
                    placeholder="John Doe, Jane Doe"
                    {...register("occupant_names")}
                  />
                </div>
                <div>
                  <FieldLabel>Number of Occupants</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    max={10}
                    {...register("occupant_count", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ── Step 1: Property & Amenities ── */}
        {step === 1 && (
          <div className="surface-card p-6 space-y-5 animate-scale-in">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Property & Amenities
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Select the unit and document included amenities
              </p>
            </div>

            <Section title="Unit">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Property *</FieldLabel>
                  <Controller
                    control={control}
                    name="property_id"
                    rules={{ required: "Property is required" }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="input-tonal border-none h-auto">
                          <SelectValue placeholder="Select property…" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.property_id && <p className="text-xs text-destructive mt-1">{errors.property_id.message}</p>}
                </div>
                <div>
                  <FieldLabel>Unit Number</FieldLabel>
                  <input
                    className="input-tonal"
                    placeholder="e.g. 2A"
                    {...register("unit_number")}
                  />
                </div>
              </div>
            </Section>

            <Section title="Counts">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Bedrooms", name: "room_count", min: 1 },
                  { label: "Bathrooms", name: "bathroom_count", min: 1 },
                  { label: "Ceiling Fans", name: "fan_count", min: 0 },
                  { label: "Bar Stools", name: "stool_count", min: 0 },
                  { label: "Stoves", name: "stove_count", min: 0 },
                  { label: "Keys", name: "key_count", min: 1 },
                ].map(({ label, name, min }) => (
                  <div key={name}>
                    <FieldLabel>{label}</FieldLabel>
                    <input
                      className="input-tonal"
                      type="number"
                      min={min}
                      {...register(name as keyof ContractFormValues, { valueAsNumber: true })}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Parking">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>Parking Included</FieldLabel>
                  <label
                    className="flex items-center gap-2.5 rounded-xl p-3 cursor-pointer transition-colors h-[42px]"
                    style={{ background: "var(--surface-card)" }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[#007aff]"
                      {...register("parking_available")}
                    />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Yes</span>
                  </label>
                </div>
                {values.parking_available && (
                  <>
                    <div>
                      <FieldLabel>Spaces</FieldLabel>
                      <input
                        className="input-tonal"
                        type="number"
                        min={1}
                        max={20}
                        {...register("parking_count", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <FieldLabel>Spot Number / ID</FieldLabel>
                      <input
                        className="input-tonal"
                        placeholder="e.g. A-1, 12"
                        {...register("parking_spot")}
                      />
                    </div>
                  </>
                )}
              </div>
            </Section>

            <Section title="Included Amenities">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "Mirror Closet Doors", name: "mirror_doors" },
                  { label: "Renovated Bathroom", name: "renovated_bathroom" },
                  { label: "Microwave", name: "microwave" },
                  { label: "Refrigerator", name: "fridge" },
                  { label: "A/C", name: "ac" },
                  { label: "Mini Blinds", name: "mini_blinds" },
                  { label: "Sofa", name: "sofa" },
                  { label: "Futon", name: "futon" },
                  { label: "Wall Art", name: "wall_art" },
                ].map(({ label, name }) => (
                  <label
                    key={name}
                    className="flex items-center gap-2.5 rounded-xl p-3 cursor-pointer transition-colors"
                    style={{ background: "var(--surface-card)" }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[#007aff]"
                      {...register(name as keyof ContractFormValues)}
                    />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── Step 2: Payment ── */}
        {step === 2 && (
          <div className="surface-card p-6 space-y-5 animate-scale-in">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Payment Terms
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Define rent amount and payment schedule
              </p>
            </div>

            <Section title="Rent">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Monthly Rent ($) *</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={0}
                    step={0.01}
                    {...register("rent_amount", { valueAsNumber: true, required: "Monthly rent is required", min: { value: 1, message: "Rent must be greater than 0" } })}
                  />
                  {errors.rent_amount && <p className="text-xs text-destructive mt-1">{errors.rent_amount.message}</p>}
                </div>
                <div>
                  <FieldLabel>Rent in Words</FieldLabel>
                  <input
                    className="input-tonal"
                    placeholder="e.g. one thousand two hundred"
                    {...register("rent_amount_verbal")}
                  />
                </div>
              </div>
            </Section>

            <Section title="Deposit">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Security Deposit ($)</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={0}
                    step={0.01}
                    {...register("security_deposit", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Schedule">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Rent Due Day of Month</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    max={28}
                    {...register("payment_due_day", { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <FieldLabel>Late Fee After Day</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={1}
                    max={28}
                    {...register("late_fee_day", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Late Fee Policy">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Fee Type</FieldLabel>
                  <Controller
                    control={control}
                    name="late_fee_type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="input-tonal border-none h-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="daily">Daily Accrual</SelectItem>
                          <SelectItem value="both">Fixed + Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <FieldLabel>Grace Period (days)</FieldLabel>
                  <input
                    className="input-tonal"
                    type="number"
                    min={0}
                    max={30}
                    {...register("late_fee_grace_period_days", { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(values.late_fee_type === "fixed" || values.late_fee_type === "both") && (
                  <div>
                    <FieldLabel>Fixed Late Fee ($)</FieldLabel>
                    <input
                      className="input-tonal"
                      type="number"
                      min={0}
                      step={0.01}
                      {...register("late_fee_fixed_amount", { valueAsNumber: true })}
                    />
                  </div>
                )}
                {(values.late_fee_type === "daily" || values.late_fee_type === "both") && (
                  <div>
                    <FieldLabel>Daily Late Fee ($)</FieldLabel>
                    <input
                      className="input-tonal"
                      type="number"
                      min={0}
                      step={0.01}
                      {...register("late_fee_daily_amount", { valueAsNumber: true })}
                    />
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ── Step 3: Signatures ── */}
        {step === 3 && (
          <div className="surface-card p-6 space-y-6 animate-scale-in">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Digital Signatures
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Both parties must sign before the contract is finalized
              </p>
            </div>

            <Controller
              control={control}
              name="landlord_signature"
              render={({ field }) => (
                <SignaturePad label="Landlord Signature" value={field.value} onChange={field.onChange} />
              )}
            />

            <div className="h-px" style={{ background: "var(--surface-container)" }} />

            <Controller
              control={control}
              name="tenant_signature"
              render={({ field }) => {
                const primaryTenant = tenants.find((t) => t.id === values.tenant_id);
                return (
                  <SignaturePad
                    label={primaryTenant ? `Tenant Signature — ${primaryTenant.full_name}` : "Tenant Signature"}
                    value={field.value}
                    onChange={field.onChange}
                  />
                );
              }}
            />

            {additionalTenantIds.filter(Boolean).map((tid, i) => {
              const ct = tenants.find((t) => t.id === tid);
              return (
                <div key={tid}>
                  <div className="h-px" style={{ background: "var(--surface-container)" }} />
                  <SignaturePad
                    label={ct ? `Co-Tenant Signature — ${ct.full_name}` : `Co-Tenant ${i + 2} Signature`}
                    value={coTenantSignatures[i] ?? ""}
                    onChange={(v) => {
                      const next = [...coTenantSignatures];
                      next[i] = v;
                      setCoTenantSignatures(next);
                    }}
                  />
                </div>
              );
            })}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="btn-tonal flex items-center gap-2"
                disabled={generating}
                onClick={handleSubmit((d) => generateAndDownload(d, "pdf"))}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                PDF
              </button>
              <button
                type="button"
                className="btn-tonal flex items-center gap-2"
                disabled={generating}
                onClick={handleSubmit((d) => generateAndDownload(d, "docx"))}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                DOCX
              </button>
              <button
                type="button"
                className="btn-tonal flex items-center gap-2"
                disabled={loading}
                onClick={handleSubmit(saveDraft)}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Draft
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Send ── */}
        {step === 4 && (
          <div className="surface-card p-6 space-y-5 animate-scale-in">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Send Contract
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Deliver DOCX to both parties via email or SMS
              </p>
            </div>

            <Section title="Email">
              <div className="space-y-4">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Sends DOCX attachment to both parties.
                </p>
                <div>
                  <FieldLabel>Your copy</FieldLabel>
                  <input
                    className="input-tonal"
                    type="email"
                    value={landlordEmailInput}
                    onChange={(e) => setLandlordEmailInput(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Tenant copy</FieldLabel>
                  {(() => {
                    const selectedTenant = tenants.find((t) => t.id === values.tenant_id);
                    return selectedTenant?.email?.trim() ? (
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Sending to: {selectedTenant.email}
                      </p>
                    ) : (
                      <p className="text-sm pill-expired inline-block">
                        No email on file for this tenant
                      </p>
                    );
                  })()}
                  {additionalTenantIds.filter(Boolean).map((tid) => {
                    const ct = tenants.find((t) => t.id === tid);
                    if (!ct) return null;
                    return ct.email?.trim() ? (
                      <p key={tid} className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                        Co-tenant: {ct.email}
                      </p>
                    ) : (
                      <p key={tid} className="text-sm pill-expired inline-block mt-1">
                        Co-tenant {ct.full_name}: no email on file
                      </p>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="SMS (Optional)">
              <label
                className="flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                style={{ background: "var(--surface-card)" }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#007aff]"
                  {...register("send_sms")}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Send via Twilio
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Send contract link via text message
                  </p>
                </div>
              </label>
              {values.send_sms && (
                <div className="mt-3">
                  <FieldLabel>Recipient Phone</FieldLabel>
                  <input
                    className="input-tonal"
                    type="tel"
                    placeholder="+1 787 555 0100"
                    {...register("recipient_phone")}
                  />
                </div>
              )}
            </Section>

            <button
              type="submit"
              className="btn-primary-gradient w-full justify-center flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Save & Send Contract
            </button>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            className="btn-tonal"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ opacity: step === 0 ? 0.4 : 1 }}
          >
            Back
          </button>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              className="btn-primary-gradient"
              onClick={async () => {
                const stepFields: Record<number, (keyof ContractFormValues)[]> = {
                  0: ["tenant_id", "lease_start"],
                  1: ["property_id"],
                  2: ["rent_amount"],
                };
                const fields = stepFields[step];
                if (fields) {
                  const valid = await trigger(fields);
                  if (!valid) return;
                }
                setStep((s) => s + 1);
              }}
            >
              Continue
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
