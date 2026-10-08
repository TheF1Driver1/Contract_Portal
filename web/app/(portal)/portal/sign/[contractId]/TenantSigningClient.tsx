"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, CheckCircle2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/FormError";
import type { Contract } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function TenantSigningClient({ contract }: { contract: Contract }) {
  const t = useTranslations("portal");
  const f = useFormatter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const property = contract.property;
  const tenant = contract.tenant;

  const day = (d: string | null | undefined) =>
    d ? f.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : "—";

  // Signing happens in the verified ceremony (consent, code, review, sign).
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/contracts/${contract.id}/sign`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.url !== "string") throw new Error(typeof json.error === "string" ? json.error : "");
      window.location.assign(json.url);
    } catch (err) {
      setError((err as Error).message || t("signing.submitFailed"));
      setSubmitting(false);
    }
  }

  const address = property ? [property.address, property.city, property.state].filter(Boolean).join(", ") : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="text-2xl font-semibold text-foreground">{t("signing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("signing.description")}</p>
      </div>

      {/* Contract summary */}
      <section aria-labelledby="lease-details" className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 id="lease-details" className="mb-4 text-base font-semibold text-foreground">
          {t("signing.details")}
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {property && (
            <Field label={t("signing.property")}>
              <span className="font-medium">{property.name}</span>
              {address && <span className="block text-xs text-muted-foreground">{address}</span>}
            </Field>
          )}
          {contract.unit_number && <Field label={t("signing.unit")}>{contract.unit_number}</Field>}
          {tenant && <Field label={t("signing.tenant")}>{tenant.full_name}</Field>}
          <Field label={t("signing.rent")}>
            <span className="tabular font-semibold">{f.number(contract.rent_amount, "money")}</span>
          </Field>
          <Field label={t("signing.start")}>{day(contract.lease_start)}</Field>
          <Field label={t("signing.end")}>{day(contract.lease_end)}</Field>
          {contract.security_deposit > 0 && (
            <Field label={t("signing.deposit")}>
              <span className="tabular">{f.number(contract.security_deposit, "money")}</span>
            </Field>
          )}
        </dl>
      </section>

      <section aria-labelledby="signature-title" className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 id="signature-title" className="mb-2 text-base font-semibold text-foreground">
          {t("signing.signatureTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("signing.howItWorks")}</p>
      </section>

      <FormError>{error}</FormError>

      {/* Sticky submit bar, thumb-reachable on phones */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mx-0 md:border-0 md:px-0 md:pb-10">
        <Button type="submit" size="lg" className="h-12 w-full text-base md:h-10 md:text-sm" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
          {t("signing.submit")}
        </Button>
      </div>
    </form>
  );
}
