"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import SignaturePad from "@/components/SignaturePad";
import { createClient } from "@/lib/supabase";
import type { Property, Tenant, ContractFormValues } from "@/lib/types";
import { Loader2, Download, Send, CheckCircle2 } from "lucide-react";

interface ContractBuilderProps {
  properties: Property[];
  tenants: Tenant[];
  userId: string;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function ContractBuilder({
  properties,
  tenants,
  userId,
}: ContractBuilderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
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
      landlord_signature: "",
      tenant_signature: "",
      send_email: false,
      send_sms: false,
      recipient_email: "",
      recipient_phone: "",
    },
  });

  const values = watch();

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
        parking: data.parking,
      };

      const payload = {
        owner_id: userId,
        property_id: data.property_id,
        tenant_id: data.tenant_id,
        contract_type: data.contract_type,
        status: "draft" as const,
        unit_number: data.unit_number || null,
        lease_start: data.lease_start,
        lease_end: data.lease_end,
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
        landlord_signature: data.landlord_signature || null,
        tenant_signature: data.tenant_signature || null,
        signed_at:
          data.landlord_signature && data.tenant_signature ? new Date().toISOString() : null,
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

      return contractId!;
    } finally {
      setLoading(false);
    }
  }

  async function generateAndDownload(data: ContractFormValues) {
    const contractId = await saveDraft(data);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_${contractId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  async function sendContract(data: ContractFormValues) {
    const contractId = await saveDraft(data);
    setLoading(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          email: data.send_email ? data.recipient_email : null,
          phone: data.send_sms ? data.recipient_phone : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/contracts/${contractId}`);
    } finally {
      setLoading(false);
    }
  }

  const STEPS = ["Details", "Property & Amenities", "Payment", "Signatures", "Send"];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-white"
                : i < step
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(sendContract)}>
        {/* Step 0: Tenant & Contract Details */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contract Type</Label>
                  <Controller
                    control={control}
                    name="contract_type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Tenant</Label>
                  <Controller
                    control={control}
                    name="tenant_id"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tenant..." />
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
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Lease Start</Label>
                  <Input type="date" {...register("lease_start", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Lease End</Label>
                  <Input type="date" {...register("lease_end", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (months)</Label>
                  <Input type="number" min={1} {...register("lease_months", { valueAsNumber: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Occupant Names (comma-separated)</Label>
                <Input
                  placeholder="John Doe, Jane Doe"
                  {...register("occupant_names")}
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Occupants</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  {...register("occupant_count", { valueAsNumber: true })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Property & Amenities */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Property & Amenities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Controller
                    control={control}
                    name="property_id"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property..." />
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
                </div>
                <div className="space-y-2">
                  <Label>Unit Number</Label>
                  <Input placeholder="e.g. 2A" {...register("unit_number")} />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Amenities</p>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Bedrooms", name: "room_count", min: 1 },
                  { label: "Ceiling Fans", name: "fan_count", min: 0 },
                  { label: "Bar Stools", name: "stool_count", min: 0 },
                  { label: "Stoves", name: "stove_count", min: 0 },
                  { label: "Keys", name: "key_count", min: 1 },
                ].map(({ label, name, min }) => (
                  <div key={name} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      min={min}
                      {...register(name as keyof ContractFormValues, { valueAsNumber: true })}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  { label: "Parking Included", name: "parking" },
                ].map(({ label, name }) => (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      {...register(name as keyof ContractFormValues)}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Monthly Rent ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    {...register("rent_amount", { valueAsNumber: true, required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rent in Words</Label>
                  <Input
                    placeholder="e.g. one thousand two hundred"
                    {...register("rent_amount_verbal")}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Security Deposit ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    {...register("security_deposit", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment at Signing ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    {...register("security_deposit", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rent Due Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    {...register("payment_due_day", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Late Fee After Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    {...register("late_fee_day", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Signatures */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Digital Signatures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Controller
                control={control}
                name="landlord_signature"
                render={({ field }) => (
                  <SignaturePad
                    label="Landlord Signature"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Separator />
              <Controller
                control={control}
                name="tenant_signature"
                render={({ field }) => (
                  <SignaturePad
                    label="Tenant Signature"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={generating}
                  onClick={handleSubmit(generateAndDownload)}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download DOCX
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={handleSubmit(saveDraft)}
                >
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Send */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Send Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50">
                <input type="checkbox" className="mt-0.5 h-4 w-4" {...register("send_email")} />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">Send PDF + DOCX as email attachment</p>
                </div>
              </label>
              {values.send_email && (
                <div className="space-y-2">
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    placeholder="tenant@example.com"
                    {...register("recipient_email")}
                  />
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50">
                <input type="checkbox" className="mt-0.5 h-4 w-4" {...register("send_sms")} />
                <div>
                  <p className="font-medium">SMS (Twilio)</p>
                  <p className="text-sm text-muted-foreground">Send contract link via text message</p>
                </div>
              </label>
              {values.send_sms && (
                <div className="space-y-2">
                  <Label>Recipient Phone</Label>
                  <Input
                    type="tel"
                    placeholder="+1 787 555 0100"
                    {...register("recipient_phone")}
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Save & Send Contract
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
