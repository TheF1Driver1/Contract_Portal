"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import SignaturePad from "@/components/SignaturePad";
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
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const property = contract.property;
  const tenant = contract.tenant;

  const day = (d: string | null | undefined) =>
    d ? f.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_signature: signature }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "");
      setDone(true);
      router.refresh();
    } catch {
      setError(t("signing.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mb-10 rounded-xl border border-border bg-surface p-5 text-center md:p-8" role="status">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-foreground">{t("signing.doneTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("signing.doneDescription")}</p>
        <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
          <Link href="/portal">{t("signing.back")}</Link>
        </Button>
      </div>
    );
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

      {/* Signature */}
      <section aria-labelledby="signature-title" className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 id="signature-title" className="mb-3 text-base font-semibold text-foreground">
          {t("signing.signatureTitle")}
        </h2>
        <div className="w-full">
          <SignaturePad label={t("signing.signatureLabel")} value={signature} onChange={setSignature} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("signing.consent")}</p>
      </section>

      <FormError>{error}</FormError>

      {/* Sticky submit bar, thumb-reachable on phones */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mx-0 md:border-0 md:px-0 md:pb-10">
        {!signature && (
          <p className="mb-2 text-center text-xs text-muted-foreground md:text-left">{t("signing.signHint")}</p>
        )}
        <Button type="submit" size="lg" className="h-12 w-full text-base md:h-10 md:text-sm" disabled={!signature || submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
          {t("signing.submit")}
        </Button>
      </div>
    </form>
  );
}
