"use client";

import { useState, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, Download, Loader2, Save, Scale, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignaturePad from "@/components/SignaturePad";
import type { ContractFormValues } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBuilder } from "./context";
import { Field } from "./Field";
import { AMENITY_FLAGS, dateOnly } from "./form-utils";

export interface ReviewActions {
  saving: boolean;
  generating: "pdf" | "docx" | null;
  sending: boolean;
  onSaveDraft: () => void;
  onDownload: (format: "pdf" | "docx") => void;
}

export function StepReview({ saving, generating, sending, onSaveDraft, onDownload }: ReviewActions) {
  const t = useTranslations("builder");
  const f = useFormatter();
  const { control } = useFormContext<ContractFormValues>();
  const v = useWatch({ control }) as ContractFormValues;
  const {
    properties,
    tenants,
    templates,
    coTenantIds,
    sections,
    landlordEmail,
    setLandlordEmail,
    goToStep,
  } = useBuilder();

  const property = properties.find((p) => p.id === v.property_id);
  const tenant = tenants.find((tn) => tn.id === v.tenant_id);
  const coTenants = coTenantIds.filter(Boolean).map((id) => tenants.find((tn) => tn.id === id));
  const template = templates.find((tpl) => tpl.id === v.template_id);
  const none = t("review.none");
  const money = (n: number | undefined) => (n ? f.number(n, "money") : none);
  const date = (d: string | undefined) => (d ? f.dateTime(dateOnly(d), { dateStyle: "medium" }) : none);
  const lateDay = Math.min(31, (v.payment_due_day ?? 1) + (v.late_fee_grace_period_days ?? 0));
  const lateFee =
    v.late_fee_type === "daily"
      ? t("review.lateFeeDaily", { daily: money(v.late_fee_daily_amount), day: lateDay })
      : v.late_fee_type === "both"
        ? t("review.lateFeeBoth", {
            fixed: money(v.late_fee_fixed_amount),
            daily: money(v.late_fee_daily_amount),
            day: lateDay,
          })
        : t("review.lateFeeFixed", { fixed: money(v.late_fee_fixed_amount), day: lateDay });
  const amenities = [
    ...AMENITY_FLAGS.filter((name) => v[name]).map((name) => t(`amenities.${name}`)),
    ...(v.custom_amenities ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const hasSignatures = !!v.landlord_signature;
  const [signOpen, setSignOpen] = useState(hasSignatures);

  return (
    <div className="space-y-4">
      <SummaryCard title={t("steps.parties")} onEdit={() => goToStep(0)} editLabel={t("review.editStep", { step: t("steps.parties") })}>
        <Row label={t("fields.property")}>
          {property ? `${property.name}${v.unit_number ? ` · ${t("review.unit", { unit: v.unit_number })}` : ""}` : none}
        </Row>
        <Row label={t("fields.tenant")}>{tenant?.full_name ?? none}</Row>
        {coTenants.length > 0 && (
          <Row label={t("parties.coTenants")}>{coTenants.map((c) => c?.full_name ?? none).join(", ")}</Row>
        )}
        <Row label={t("parties.occupantsTitle")}>
          {t("review.occupants", { count: v.occupant_count ?? 1 })}
          {v.occupant_names ? ` · ${v.occupant_names}` : ""}
        </Row>
        <Row label={t("fields.contractType")}>{t(`contractType.${v.contract_type ?? "lease"}`)}</Row>
        <Row label={t("fields.template")}>{template?.name ?? t("fields.templateDefault")}</Row>
        <Row label={t("fields.jurisdiction")}>{t(`jurisdiction.${v.jurisdiction ?? "pr"}`)}</Row>
      </SummaryCard>

      <SummaryCard title={t("steps.terms")} onEdit={() => goToStep(1)} editLabel={t("review.editStep", { step: t("steps.terms") })}>
        <Row label={t("review.term")}>
          {t("review.termValue", { start: date(v.lease_start), end: date(v.lease_end), months: v.lease_months ?? 0 })}
        </Row>
        <Row label={t("fields.rent")}>
          <span className="tabular">{money(v.rent_amount)}</span>
          {v.rent_amount_verbal ? ` (${v.rent_amount_verbal})` : ""}
        </Row>
        <Row label={t("fields.deposit")}>
          <span className="tabular">{money(v.security_deposit)}</span>
        </Row>
        <Row label={t("fields.dueDay")}>{t("review.dueDay", { day: v.payment_due_day ?? 1 })}</Row>
        <Row label={t("terms.lateFeeTitle")}>{lateFee}</Row>
        <Row label={t("fields.keys")}>{v.key_count ?? 0}</Row>
      </SummaryCard>

      <SummaryCard title={t("steps.clauses")} onEdit={() => goToStep(2)} editLabel={t("review.editStep", { step: t("steps.clauses") })}>
        <Row label={t("clauses.amenitiesTitle")}>{amenities.length ? amenities.join(", ") : none}</Row>
        <Row label={t("clauses.parkingTitle")}>
          {v.parking_available
            ? t("review.parking", { count: v.parking_count ?? 1 }) +
              (v.parking_spot ? ` · ${v.parking_spot}` : "")
            : t("review.noParking")}
        </Row>
        <Row label={t("clauses.customTitle")}>
          {sections.length ? sections.map((s) => s.title).join(", ") : none}
        </Row>
      </SummaryCard>

      <section className="flex gap-3 rounded-xl border border-border bg-surface-muted p-4 md:p-5">
        <Scale className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-2 text-sm">
          <h3 className="text-base font-semibold text-foreground">{t("review.lawTitle")}</h3>
          <p className="text-foreground">{t(`review.law.${v.jurisdiction ?? "pr"}`)}</p>
          {v.jurisdiction === "pr" && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t("review.prIncludes.daco")}</li>
              <li>{t("review.prIncludes.nonRenewal")}</li>
              <li>{t("review.prIncludes.depositReturn")}</li>
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("review.lawDisclaimer")}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-4 md:p-5">
        <h3 className="text-base font-semibold text-foreground">{t("review.deliveryTitle")}</h3>
        <Field id="landlord_email" label={t("review.yourCopy")} hint={t("review.yourCopyHint")}>
          <Input
            id="landlord_email"
            type="email"
            className="h-10"
            autoComplete="email"
            value={landlordEmail}
            onChange={(e) => setLandlordEmail(e.target.value)}
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{t("review.tenantCopy")}</p>
          <RecipientLine name={tenant?.full_name} email={tenant?.email} />
          {coTenants.map((c, i) => c && <RecipientLine key={c.id ?? i} name={c.full_name} email={c.email} />)}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl p-4 text-left md:p-5"
          aria-expanded={signOpen}
          aria-controls="in-person-signatures"
          onClick={() => setSignOpen((o) => !o)}
        >
          <span>
            <span className="block text-base font-semibold text-foreground">{t("signatures.title")}</span>
            <span className="block text-sm text-muted-foreground">{t("signatures.description")}</span>
          </span>
          <ChevronDown
            className={cn("size-5 shrink-0 text-muted-foreground transition-transform", signOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {signOpen && (
          <div id="in-person-signatures" className="space-y-6 border-t border-border p-4 md:p-5">
            <Controller
              control={control}
              name="landlord_signature"
              render={({ field }) => (
                <SignaturePad label={t("signatures.landlord")} value={field.value} onChange={field.onChange} />
              )}
            />
            <p className="text-sm text-muted-foreground">{t("signatures.tenantRemote")}</p>

          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4 md:p-5">
        <h3 className="text-base font-semibold text-foreground">{t("review.actionsTitle")}</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" className="h-10" disabled={saving || sending} onClick={onSaveDraft}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {t("actions.saveDraft")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!!generating || sending}
            onClick={() => onDownload("pdf")}
          >
            {generating === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
            {t("actions.downloadPdf")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!!generating || sending}
            onClick={() => onDownload("docx")}
          >
            {generating === "docx" ? <Loader2 className="animate-spin" /> : <Download />}
            {t("actions.downloadDocx")}
          </Button>
          <Button type="submit" className="h-10 sm:ml-auto" disabled={sending || saving || !!generating}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {t("actions.send")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  const t = useTranslations("builder");
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="link" className="h-10 px-0 md:h-8" aria-label={editLabel} onClick={onEdit}>
          {t("review.edit")}
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mb-2 min-w-0 break-words text-foreground sm:mb-0">{children}</dd>
    </>
  );
}

function RecipientLine({ name, email }: { name?: string | null; email?: string | null }) {
  const t = useTranslations("builder");
  if (email?.trim()) {
    return (
      <p className="text-sm text-muted-foreground">
        {name ? `${name} · ` : ""}
        <span className="text-foreground">{email}</span>
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-2 rounded-md bg-warning-soft px-2 py-1 text-sm text-foreground">
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
      {name ? t("review.noEmailNamed", { name }) : t("review.noTenant")}
    </p>
  );
}
