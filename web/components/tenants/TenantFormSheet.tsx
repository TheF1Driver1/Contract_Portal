"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { FieldGroup } from "@/components/properties/PropertyFormSheet";
import { createTenant, updateTenant } from "@/lib/actions/records";
import type { Tenant } from "@/lib/types";

type Address = { street: string; unit: string; city: string; state: string; zip: string; country: string };

const EMPTY_ADDR: Address = { street: "", unit: "", city: "", state: "", zip: "", country: "US" };

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  ssn_last4: "",
  license_number: "",
  date_of_birth: "",
  employer_name: "",
  employer_phone: "",
  monthly_income: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  preferred_locale: "es" as Locale,
};

type Locale = "es" | "en";
type FormState = typeof EMPTY_FORM;

function buildAddress(a: Address) {
  return [a.street, a.unit, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ");
}

function fromTenant(t: Tenant): { form: FormState; cur: Address; prev: Address } {
  return {
    form: {
      full_name: t.full_name,
      email: t.email ?? "",
      phone: t.phone ?? "",
      ssn_last4: t.ssn_last4 ?? "",
      license_number: t.license_number ?? "",
      date_of_birth: t.date_of_birth ?? "",
      employer_name: t.employer_name ?? "",
      employer_phone: t.employer_phone ?? "",
      monthly_income: t.monthly_income != null ? String(t.monthly_income) : "",
      emergency_contact_name: t.emergency_contact_name ?? "",
      emergency_contact_phone: t.emergency_contact_phone ?? "",
      preferred_locale: t.preferred_locale === "en" ? "en" : "es",
    },
    cur: {
      street: t.current_street ?? "",
      unit: t.current_unit ?? "",
      city: t.current_city ?? "",
      state: t.current_state ?? "",
      zip: t.current_zip ?? "",
      country: t.current_country ?? "US",
    },
    prev: {
      street: t.previous_street ?? "",
      unit: t.previous_unit ?? "",
      city: t.previous_city ?? "",
      state: t.previous_state ?? "",
      zip: t.previous_zip ?? "",
      country: t.previous_country ?? "US",
    },
  };
}

function AddressFields({
  idPrefix,
  title,
  value,
  onChange,
}: {
  idPrefix: string;
  title: string;
  value: Address;
  onChange: (next: (a: Address) => Address) => void;
}) {
  const t = useTranslations("tenants.form");
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <FieldGroup title={title}>
      <AddressAutocomplete
        id={id("street")}
        label={t("street")}
        placeholder={t("streetPlaceholder")}
        value={value.street}
        onChange={(v) => onChange((a) => ({ ...a, street: v }))}
        onSelect={(parts) => onChange((a) => ({ ...a, ...parts }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("unit")}>{t("unit")}</Label>
          <Input
            id={id("unit")}
            placeholder={t("unitPlaceholder")}
            autoComplete="off"
            value={value.unit}
            onChange={(e) => onChange((a) => ({ ...a, unit: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("city")}>{t("city")}</Label>
          <Input
            id={id("city")}
            placeholder="San Juan"
            autoComplete="off"
            value={value.city}
            onChange={(e) => onChange((a) => ({ ...a, city: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("state")}>{t("state")}</Label>
          <Input
            id={id("state")}
            placeholder="PR"
            autoComplete="off"
            value={value.state}
            onChange={(e) => onChange((a) => ({ ...a, state: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("zip")}>{t("zip")}</Label>
          <Input
            id={id("zip")}
            placeholder="00901"
            inputMode="numeric"
            autoComplete="off"
            value={value.zip}
            onChange={(e) => onChange((a) => ({ ...a, zip: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("country")}>{t("country")}</Label>
          <Input
            id={id("country")}
            placeholder="US"
            autoComplete="off"
            value={value.country}
            onChange={(e) => onChange((a) => ({ ...a, country: e.target.value }))}
          />
        </div>
      </div>
    </FieldGroup>
  );
}

/**
 * Create (no `tenant`) or edit a tenant. The data belongs to someone other
 * than the signed-in landlord, so browser autofill is turned off.
 */
export function TenantFormSheet({
  tenant,
  open,
  onOpenChange,
}: {
  tenant?: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("tenants.form");
  const tc = useTranslations("common");
  const router = useRouter();
  const uid = useId();
  const formId = `${uid}-tenant-form`;
  const fid = (name: string) => `${uid}-${name}`;
  const editing = !!tenant;

  const initial = tenant ? fromTenant(tenant) : null;
  const [form, setForm] = useState<FormState>(initial?.form ?? EMPTY_FORM);
  const [cur, setCur] = useState<Address>(initial?.cur ?? EMPTY_ADDR);
  const [prev, setPrev] = useState<Address>(initial?.prev ?? EMPTY_ADDR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
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
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      ssn_last4: form.ssn_last4 || null,
      license_number: form.license_number || null,
      date_of_birth: form.date_of_birth || null,
      employer_name: form.employer_name || null,
      employer_phone: form.employer_phone || null,
      monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      preferred_locale: form.preferred_locale,
      current_street: cur.street || null,
      current_unit: cur.unit || null,
      current_city: cur.city || null,
      current_state: cur.state || null,
      current_zip: cur.zip || null,
      current_country: cur.country || null,
      current_address: buildAddress(cur) || null,
      previous_street: prev.street || null,
      previous_unit: prev.unit || null,
      previous_city: prev.city || null,
      previous_state: prev.state || null,
      previous_zip: prev.zip || null,
      previous_country: prev.country || null,
    };
    const result = tenant ? await updateTenant(tenant.id, values) : await createTenant(values);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(editing ? t("updated") : t("created"));
    if (!editing) {
      setForm(EMPTY_FORM);
      setCur(EMPTY_ADDR);
      setPrev(EMPTY_ADDR);
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      wide
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
            <Label htmlFor={fid("name")}>{t("fullName")}</Label>
            <Input
              id={fid("name")}
              placeholder={t("fullNamePlaceholder")}
              autoComplete="off"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={fid("email")}>{t("email")}</Label>
              <Input
                id={fid("email")}
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder={t("emailPlaceholder")}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("phone")}>{t("phone")}</Label>
              <Input
                id={fid("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder={t("phonePlaceholder")}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={fid("dob")}>{t("dob")}</Label>
              <Input
                id={fid("dob")}
                type="date"
                autoComplete="off"
                value={form.date_of_birth}
                onChange={(e) => update("date_of_birth", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("ssn")}>{t("ssnLast4")}</Label>
              <Input
                id={fid("ssn")}
                inputMode="numeric"
                autoComplete="off"
                pattern="\d{4}"
                maxLength={4}
                placeholder="6789"
                title={t("ssnHint")}
                value={form.ssn_last4}
                onChange={(e) => update("ssn_last4", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("license")}>{t("license")}</Label>
              <Input
                id={fid("license")}
                autoComplete="off"
                placeholder="A1234567"
                value={form.license_number}
                onChange={(e) => update("license_number", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:max-w-[50%]">
            <Label htmlFor={fid("locale")}>{t("preferredLocale")}</Label>
            <Select value={form.preferred_locale} onValueChange={(v) => update("preferred_locale", v === "en" ? "en" : "es")}>
              <SelectTrigger id={fid("locale")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("localeEs")}</SelectItem>
                <SelectItem value="en">{t("localeEn")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("preferredLocaleHint")}</p>
          </div>
        </FieldGroup>

        <AddressFields idPrefix={fid("cur")} title={t("currentAddress")} value={cur} onChange={setCur} />
        <AddressFields idPrefix={fid("prev")} title={t("previousAddress")} value={prev} onChange={setPrev} />

        <FieldGroup title={t("employment")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={fid("employer")}>{t("employerName")}</Label>
              <Input
                id={fid("employer")}
                autoComplete="off"
                value={form.employer_name}
                onChange={(e) => update("employer_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("employerPhone")}>{t("employerPhone")}</Label>
              <Input
                id={fid("employerPhone")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.employer_phone}
                onChange={(e) => update("employer_phone", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:max-w-[50%]">
            <Label htmlFor={fid("income")}>{t("monthlyIncome")}</Label>
            <Input
              id={fid("income")}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              className="tabular"
              value={form.monthly_income}
              onChange={(e) => update("monthly_income", e.target.value)}
            />
          </div>
        </FieldGroup>

        <FieldGroup title={t("emergency")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={fid("emName")}>{t("emergencyName")}</Label>
              <Input
                id={fid("emName")}
                autoComplete="off"
                value={form.emergency_contact_name}
                onChange={(e) => update("emergency_contact_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fid("emPhone")}>{t("emergencyPhone")}</Label>
              <Input
                id={fid("emPhone")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.emergency_contact_phone}
                onChange={(e) => update("emergency_contact_phone", e.target.value)}
              />
            </div>
          </div>
        </FieldGroup>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
