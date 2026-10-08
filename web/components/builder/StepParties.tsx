"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContractFormValues } from "@/lib/types";
import { useBuilder } from "./context";
import { Field, StepSection } from "./Field";

const DEFAULT_TEMPLATE = "__default";
const MAX_CO_TENANTS = 5;

export function StepParties() {
  const t = useTranslations("builder");
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ContractFormValues>();
  const { properties, tenants, templates, coTenantIds, setCoTenantIds, coTenantSignatures, setCoTenantSignatures } =
    useBuilder();
  const [tenantId, contractType] = useWatch({ control, name: ["tenant_id", "contract_type"] });

  const visibleTemplates = templates.filter(
    (tpl) => tpl.contract_type === "all" || tpl.contract_type === contractType
  );

  return (
    <div className="space-y-4">
      <StepSection title={t("parties.propertyTitle")} description={t("parties.propertyDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="property_id"
            label={t("fields.property")}
            required
            error={errors.property_id?.message}
          >
            <Controller
              control={control}
              name="property_id"
              rules={{ required: t("errors.propertyRequired") }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="property_id"
                    className="h-10 w-full"
                    aria-invalid={!!errors.property_id}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder={t("fields.propertyPlaceholder")} />
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
          </Field>
          <Field id="unit_number" label={t("fields.unit")}>
            <Input
              id="unit_number"
              className="h-10"
              placeholder={t("fields.unitPlaceholder")}
              {...register("unit_number")}
            />
          </Field>
          <Field id="jurisdiction" label={t("fields.jurisdiction")} className="sm:col-span-2">
            <Controller
              control={control}
              name="jurisdiction"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="jurisdiction" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pr">{t("jurisdiction.pr")}</SelectItem>
                    <SelectItem value="us_mainland">{t("jurisdiction.us_mainland")}</SelectItem>
                    <SelectItem value="other">{t("jurisdiction.other")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </StepSection>

      <StepSection title={t("parties.tenantTitle")} description={t("parties.tenantDescription")}>
        <Field id="tenant_id" label={t("fields.tenant")} required error={errors.tenant_id?.message}>
          <Controller
            control={control}
            name="tenant_id"
            rules={{ required: t("errors.tenantRequired") }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  id="tenant_id"
                  className="h-10 w-full"
                  aria-invalid={!!errors.tenant_id}
                  onBlur={field.onBlur}
                >
                  <SelectValue placeholder={t("fields.tenantPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tn) => (
                    <SelectItem key={tn.id} value={tn.id}>
                      {tn.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t("parties.coTenants")}</p>
          {coTenantIds.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("parties.coTenantsEmpty")}</p>
          )}
          {coTenantIds.map((tid, i) => {
            const taken = new Set([tenantId, ...coTenantIds.filter((_, j) => j !== i)]);
            const id = `co_tenant_${i}`;
            return (
              <div key={i} className="flex items-end gap-2">
                <Field id={id} label={t("parties.coTenantLabel", { n: i + 1 })} className="flex-1">
                  <Select
                    value={tid}
                    onValueChange={(v) => {
                      const next = [...coTenantIds];
                      next[i] = v;
                      setCoTenantIds(next);
                      const sigs = [...coTenantSignatures];
                      sigs[i] = "";
                      setCoTenantSignatures(sigs);
                    }}
                  >
                    <SelectTrigger id={id} className="h-10 w-full">
                      <SelectValue placeholder={t("parties.coTenantPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants
                        .filter((tn) => !taken.has(tn.id))
                        .map((tn) => (
                          <SelectItem key={tn.id} value={tn.id}>
                            {tn.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={t("parties.removeCoTenant", { n: i + 1 })}
                  onClick={() => {
                    setCoTenantIds(coTenantIds.filter((_, j) => j !== i));
                    setCoTenantSignatures(coTenantSignatures.filter((_, j) => j !== i));
                  }}
                >
                  <X />
                </Button>
              </div>
            );
          })}
          {coTenantIds.length < MAX_CO_TENANTS && (
            <Button
              type="button"
              variant="outline"
              className="h-10 md:h-9"
              onClick={() => {
                setCoTenantIds([...coTenantIds, ""]);
                setCoTenantSignatures([...coTenantSignatures, ""]);
              }}
            >
              <Plus />
              {t("parties.addCoTenant")}
            </Button>
          )}
        </div>
      </StepSection>

      <StepSection title={t("parties.occupantsTitle")} description={t("parties.occupantsDescription")}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field id="occupant_names" label={t("fields.occupantNames")} hint={t("fields.occupantNamesHint")}>
            <Input
              id="occupant_names"
              className="h-10"
              placeholder={t("fields.occupantNamesPlaceholder")}
              {...register("occupant_names")}
            />
          </Field>
          <Field id="occupant_count" label={t("fields.occupantCount")} error={errors.occupant_count?.message}>
            <Input
              id="occupant_count"
              className="h-10 tabular"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              {...register("occupant_count", {
                valueAsNumber: true,
                min: { value: 1, message: t("errors.occupantsMin") },
              })}
            />
          </Field>
        </div>
      </StepSection>

      <StepSection title={t("parties.documentTitle")} description={t("parties.documentDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contract_type" label={t("fields.contractType")}>
            <Controller
              control={control}
              name="contract_type"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="contract_type" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lease">{t("contractType.lease")}</SelectItem>
                    <SelectItem value="rental">{t("contractType.rental")}</SelectItem>
                    <SelectItem value="addendum">{t("contractType.addendum")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="template_id" label={t("fields.template")} hint={t("fields.templateHint")}>
            <Controller
              control={control}
              name="template_id"
              render={({ field }) => (
                <Select
                  onValueChange={(v) => field.onChange(v === DEFAULT_TEMPLATE ? "" : v)}
                  value={field.value || DEFAULT_TEMPLATE}
                >
                  <SelectTrigger id="template_id" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_TEMPLATE}>{t("fields.templateDefault")}</SelectItem>
                    {visibleTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                    {field.value && !visibleTemplates.some((tpl) => tpl.id === field.value) && (
                      <SelectItem value={field.value}>
                        {templates.find((tpl) => tpl.id === field.value)?.name ?? t("fields.templateUnknown")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </StepSection>
    </div>
  );
}
