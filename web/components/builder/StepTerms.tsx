"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContractFormValues } from "@/lib/types";
import { Field, StepSection } from "./Field";
import { toNumberOrUndefined } from "./form-utils";

export function StepTerms() {
  const t = useTranslations("builder");
  const f = useFormatter();
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ContractFormValues>();
  const [leaseStart, leaseEnd, rent, deposit, jurisdiction, dueDay, grace, lateFeeType] = useWatch({
    control,
    name: [
      "lease_start",
      "lease_end",
      "rent_amount",
      "security_deposit",
      "jurisdiction",
      "payment_due_day",
      "late_fee_grace_period_days",
      "late_fee_type",
    ],
  });

  const firstLateDay =
    Number.isFinite(dueDay) && Number.isFinite(grace) ? Math.min(31, Number(dueDay) + Number(grace)) : null;
  const depositAboveRent = !!deposit && !!rent && deposit > rent;

  return (
    <div className="space-y-4">
      <StepSection title={t("terms.periodTitle")} description={t("terms.periodDescription")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="lease_start" label={t("fields.leaseStart")} required error={errors.lease_start?.message}>
            <Input
              id="lease_start"
              type="date"
              className="h-10"
              data-empty={!leaseStart || undefined}
              aria-invalid={!!errors.lease_start}
              {...register("lease_start", { required: t("errors.startRequired") })}
            />
          </Field>
          <Field
            id="lease_months"
            label={t("fields.leaseMonths")}
            error={errors.lease_months?.message}
          >
            <Input
              id="lease_months"
              type="number"
              inputMode="numeric"
              min={1}
              className="h-10 tabular"
              {...register("lease_months", {
                valueAsNumber: true,
                min: { value: 1, message: t("errors.monthsMin") },
              })}
            />
          </Field>
          <Field
            id="lease_end"
            label={t("fields.leaseEnd")}
            required
            hint={t("fields.leaseEndHint")}
            error={errors.lease_end?.message}
          >
            <Input
              id="lease_end"
              type="date"
              className="h-10"
              data-empty={!leaseEnd || undefined}
              aria-invalid={!!errors.lease_end}
              {...register("lease_end", {
                required: t("errors.endRequired"),
                validate: (v, all) => !all.lease_start || v > all.lease_start || t("errors.endAfterStart"),
              })}
            />
          </Field>
        </div>
      </StepSection>

      <StepSection title={t("terms.rentTitle")} description={t("terms.rentDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rent_amount" label={t("fields.rent")} required error={errors.rent_amount?.message}>
            <Input
              id="rent_amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="0.00"
              className="h-10 tabular"
              aria-invalid={!!errors.rent_amount}
              {...register("rent_amount", {
                setValueAs: toNumberOrUndefined,
                required: t("errors.rentRequired"),
                min: { value: 1, message: t("errors.rentMin") },
              })}
            />
          </Field>
          <Field id="rent_amount_verbal" label={t("fields.rentVerbal")} hint={t("fields.rentVerbalHint")}>
            <Input
              id="rent_amount_verbal"
              className="h-10"
              placeholder={t("fields.rentVerbalPlaceholder")}
              {...register("rent_amount_verbal")}
            />
          </Field>
          <Field
            id="payment_due_day"
            label={t("fields.dueDay")}
            hint={firstLateDay != null ? t("fields.firstLateDay", { day: firstLateDay }) : undefined}
            error={errors.payment_due_day?.message}
          >
            <Input
              id="payment_due_day"
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              className="h-10 tabular"
              {...register("payment_due_day", {
                valueAsNumber: true,
                min: { value: 1, message: t("errors.dueDayRange") },
                max: { value: 28, message: t("errors.dueDayRange") },
              })}
            />
          </Field>
          <Field id="security_deposit" label={t("fields.deposit")}>
            <Input
              id="security_deposit"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="0.00"
              className="h-10 tabular"
              aria-describedby="deposit-note"
              {...register("security_deposit", { setValueAs: toNumberOrUndefined })}
            />
          </Field>
        </div>
        <div
          id="deposit-note"
          className="flex gap-2 rounded-lg bg-info-soft p-3 text-sm text-foreground"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <div className="space-y-1">
            <p>{jurisdiction === "pr" ? t("terms.depositNotePr") : t("terms.depositNoteOther")}</p>
            {depositAboveRent && (
              <p className="text-muted-foreground">
                {t("terms.depositAboveRent", {
                  deposit: f.number(deposit ?? 0, "money"),
                  rent: f.number(rent ?? 0, "money"),
                })}
              </p>
            )}
          </div>
        </div>
      </StepSection>

      <StepSection title={t("terms.lateFeeTitle")} description={t("terms.lateFeeDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="late_fee_type" label={t("fields.lateFeeType")}>
            <Controller
              control={control}
              name="late_fee_type"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="late_fee_type" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t("lateFeeType.fixed")}</SelectItem>
                    <SelectItem value="daily">{t("lateFeeType.daily")}</SelectItem>
                    <SelectItem value="both">{t("lateFeeType.both")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="late_fee_grace_period_days" label={t("fields.graceDays")}>
            <Input
              id="late_fee_grace_period_days"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              className="h-10 tabular"
              {...register("late_fee_grace_period_days", { valueAsNumber: true })}
            />
          </Field>
          {(lateFeeType === "fixed" || lateFeeType === "both") && (
            <Field id="late_fee_fixed_amount" label={t("fields.lateFeeFixed")}>
              <Input
                id="late_fee_fixed_amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="h-10 tabular"
                {...register("late_fee_fixed_amount", { setValueAs: toNumberOrUndefined })}
              />
            </Field>
          )}
          {(lateFeeType === "daily" || lateFeeType === "both") && (
            <Field id="late_fee_daily_amount" label={t("fields.lateFeeDaily")}>
              <Input
                id="late_fee_daily_amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="h-10 tabular"
                {...register("late_fee_daily_amount", { setValueAs: toNumberOrUndefined })}
              />
            </Field>
          )}
        </div>
      </StepSection>

      <StepSection title={t("terms.keysTitle")}>
        <Field id="key_count" label={t("fields.keys")} className="max-w-[10rem]">
          <Input
            id="key_count"
            type="number"
            inputMode="numeric"
            min={1}
            className="h-10 tabular"
            {...register("key_count", { valueAsNumber: true })}
          />
        </Field>
      </StepSection>
    </div>
  );
}
