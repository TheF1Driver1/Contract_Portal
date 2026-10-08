"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Clock, FileDown, FileEdit, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInspection } from "@/lib/actions/inspections";
import type { InspectionKind } from "@/lib/db";
import type { InspectionSummary } from "@/components/inspections/types";
import { cn } from "@/lib/utils";

const KINDS: InspectionKind[] = ["move_in", "move_out"];

/** "Inspecciones" on the contract page: list plus "Nueva inspección (entrada/salida)". */
export function InspectionsSection({ contractId, inspections, canCreate }: { contractId: string; inspections: InspectionSummary[]; canCreate: boolean }) {
  const t = useTranslations("inspections");
  const f = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState<InspectionKind | null>(null);
  const day = (d: string) => f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" });
  const missing = KINDS.filter((k) => !inspections.some((i) => i.kind === k));

  async function create(kind: InspectionKind) {
    setBusy(kind);
    const res = await createInspection({ contract_id: contractId, kind });
    setBusy(null);
    if (!res.ok || !res.id) return void toast.error(res.ok ? t("createFailed") : res.error);
    toast.success(t("created"));
    router.push(`/contracts/${contractId}/inspections/${res.id}`);
  }

  return (
    <div className="space-y-4">
      {inspections.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="divide-y">
          {inspections.map((i) => {
            const done = i.status === "completed";
            return (
              <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {t(`kind.${i.kind}`)}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        done ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground"
                      )}
                    >
                      {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : <FileEdit className="size-3.5" aria-hidden />}
                      {t(`status.${i.status}`)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {day(i.inspected_on)} · {t("progress", { rated: i.rated, total: i.total })}
                  </p>
                  {done && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {i.tenant_acknowledged_at ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                          {t("acknowledged", { date: day(i.tenant_acknowledged_at) })}
                        </>
                      ) : (
                        <>
                          <Clock className="size-3.5" aria-hidden />
                          {t("awaitingAck")}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
                    <Link href={`/contracts/${contractId}/inspections/${i.id}`}>{done ? t("view") : t("continue")}</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-10 sm:h-8">
                    <a href={`/api/inspections/${i.id}/pdf`} target="_blank" rel="noopener" aria-label={t("pdfLabel", { kind: t(`kind.${i.kind}`) })}>
                      <FileDown aria-hidden />
                      PDF
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canCreate && missing.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {missing.map((k) => (
            <Button key={k} variant="outline" onClick={() => create(k)} disabled={!!busy}>
              {busy === k ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {t(`new.${k}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
