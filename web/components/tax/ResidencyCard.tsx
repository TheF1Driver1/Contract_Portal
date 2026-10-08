"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { SegmentedControl } from "@/components/settings/SegmentedControl";
import { setTaxResidency } from "@/lib/actions/tax";
import type { TaxResidency } from "@/lib/db";

/** Owner's tax residency: picks the default report (Anejo N or Schedule E). */
export function ResidencyCard({ initial }: { initial: TaxResidency | null }) {
  const t = useTranslations("tax.residency");
  const [value, setValue] = useState<TaxResidency | null>(initial);
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    const v = next === "unset" ? null : (next as TaxResidency);
    const prev = value;
    setValue(v);
    startTransition(async () => {
      const res = await setTaxResidency({ tax_residency: v }).catch(() => ({ ok: false as const, error: t("failed") }));
      if (!res.ok) {
        setValue(prev);
        toast.error(res.error);
      } else toast.success(t("saved"));
    });
  }

  const hint = value === "pr_resident" ? t("prHint") : value === "non_resident" ? t("nonHint") : t("unsetHint");

  return (
    <section aria-labelledby="residency-title" className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Landmark className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 id="residency-title" className="text-base font-semibold text-foreground">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <SegmentedControl
            label={t("label")}
            value={value ?? "unset"}
            onChange={choose}
            disabled={pending}
            options={[
              { value: "pr_resident", label: t("pr_resident") },
              { value: "non_resident", label: t("non_resident") },
              { value: "unset", label: t("unset") },
            ]}
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {hint}
          </p>
        </div>
      </div>
    </section>
  );
}
