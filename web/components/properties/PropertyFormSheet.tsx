"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createProperty, updateProperty } from "@/lib/actions/records";
import type { Property } from "@/lib/types";

type FormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  unit_count: number;
  bathroom_count: number;
  parking_available: boolean;
  parking_count: number;
};

const EMPTY: FormState = {
  name: "",
  address: "",
  city: "",
  state: "PR",
  zip: "",
  unit_count: 1,
  bathroom_count: 1,
  parking_available: false,
  parking_count: 0,
};

function fromProperty(p: Property): FormState {
  return {
    name: p.name,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip ?? "",
    unit_count: p.unit_count,
    bathroom_count: p.bathroom_count ?? 1,
    parking_available: p.parking_available ?? false,
    parking_count: p.parking_count ?? 0,
  };
}

/** Plan-limit errors from the server mention the plan; offer the billing page. */
function isPlanLimit(error: string) {
  return /plan/i.test(error);
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-semibold text-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Create (no `property`) or edit a property. Writes go through the
 * `createProperty` / `updateProperty` server actions.
 */
export function PropertyFormSheet({
  property,
  open,
  onOpenChange,
}: {
  property?: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("properties.form");
  const tc = useTranslations("common");
  const router = useRouter();
  const uid = useId();
  const formId = `${uid}-property-form`;
  const fid = (name: string) => `${uid}-${name}`;
  const editing = !!property;

  const [form, setForm] = useState<FormState>(property ? fromProperty(property) : EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const values = {
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip || null,
      unit_count: form.unit_count,
      bathroom_count: form.bathroom_count,
      parking_available: form.parking_available,
      parking_count: form.parking_available ? form.parking_count : null,
    };
    const result = property ? await updateProperty(property.id, values) : await createProperty(values);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(editing ? t("updated") : t("created"));
    if (!editing) setForm(EMPTY);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={editing ? t("editTitle") : t("createTitle")}
      description={editing ? undefined : t("createDescription")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={loading}>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {loading ? t("saving") : editing ? t("saveChanges") : t("save")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-6">
        {editing && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t("editWarning")}
          </p>
        )}

        <FieldGroup title={t("basics")}>
          <div className="space-y-1.5">
            <Label htmlFor={fid("name")}>{t("name")}</Label>
            <Input
              id={fid("name")}
              placeholder={t("namePlaceholder")}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={fid("units")}>{t("unitCount")}</Label>
              <Input
                id={fid("units")}
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={form.unit_count}
                onChange={(e) => set("unit_count", parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("baths")}>{t("bathrooms")}</Label>
              <Input
                id={fid("baths")}
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                value={form.bathroom_count}
                onChange={(e) => set("bathroom_count", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={fid("parking")}
              checked={form.parking_available}
              onCheckedChange={(v) => set("parking_available", v === true)}
            />
            <Label htmlFor={fid("parking")} className="font-normal">
              {t("parkingIncluded")}
            </Label>
          </div>
          {form.parking_available && (
            <div className="space-y-1.5">
              <Label htmlFor={fid("parkingCount")}>{t("parkingCount")}</Label>
              <Input
                id={fid("parkingCount")}
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                value={form.parking_count}
                onChange={(e) => set("parking_count", parseInt(e.target.value) || 0)}
              />
            </div>
          )}
        </FieldGroup>

        <FieldGroup title={t("addressGroup")}>
          <div className="space-y-1.5">
            <Label htmlFor={fid("address")}>{t("street")}</Label>
            <Input
              id={fid("address")}
              placeholder={t("streetPlaceholder")}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fid("city")}>{t("city")}</Label>
            <Input
              id={fid("city")}
              placeholder={t("cityPlaceholder")}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={fid("state")}>{t("state")}</Label>
              <Input
                id={fid("state")}
                placeholder="PR"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                autoComplete="off"
                maxLength={10}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("zip")}>{t("zip")}</Label>
              <Input
                id={fid("zip")}
                placeholder="00901"
                inputMode="numeric"
                value={form.zip}
                onChange={(e) => set("zip", e.target.value)}
                autoComplete="off"
                maxLength={20}
              />
            </div>
          </div>
        </FieldGroup>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}{" "}
            {isPlanLimit(error) && (
              <Link href="/settings/billing" className="font-semibold underline underline-offset-2">
                {t("seePlans")}
              </Link>
            )}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
