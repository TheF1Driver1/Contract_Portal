"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaintenanceStatusBadge } from "@/components/maintenance/Badges";
import { RequestForm } from "@/components/maintenance/RequestForm";
import { Timeline } from "@/components/maintenance/Timeline";
import { addMaintenanceNote } from "@/lib/actions/maintenance";
import { isOpen } from "@/lib/maintenance/logic";
import type { InspectionKind, MaintenanceRequest, MaintenanceUpdate } from "@/lib/db";

export type PortalRequest = Pick<MaintenanceRequest, "id" | "title" | "status" | "category" | "scheduled_for" | "created_at"> & {
  updates: Pick<MaintenanceUpdate, "id" | "author_kind" | "note" | "status_change" | "created_at">[];
};
export type PortalInspection = { id: string; kind: InspectionKind; inspected_on: string; acknowledged: boolean };

/** Tenant portal: repair requests and inspections for one lease. */
export function PortalLeaseExtras({
  contractId,
  canRequest,
  requests,
  inspections,
}: {
  contractId: string;
  canRequest: boolean;
  requests: PortalRequest[];
  inspections: PortalInspection[];
}) {
  const t = useTranslations("maintenance.portal");
  const ti = useTranslations("inspections");
  const f = useFormatter();
  const [open, setOpen] = useState(false);
  const day = (d: string) => f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" });

  if (!canRequest && requests.length === 0 && inspections.length === 0) return null;

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {inspections.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">{ti("portal.title")}</h4>
          <ul className="divide-y text-sm">
            {inspections.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{ti(`kind.${i.kind}`)} · {day(i.inspected_on)}</span>
                  <span className="block text-xs text-muted-foreground">{i.acknowledged ? ti("portal.reviewed") : ti("portal.toReview")}</span>
                </span>
                <Button asChild variant={i.acknowledged ? "outline" : "default"} size="sm" className="h-10 shrink-0 sm:h-8">
                  <Link href={`/portal/inspections/${i.id}`}>
                    <ClipboardCheck aria-hidden />
                    {i.acknowledged ? ti("portal.view") : ti("portal.review")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">{t("title")}</h4>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {requests.map((r) => (
              <li key={r.id} className="py-1.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{r.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.scheduled_for && isOpen(r.status) ? t("visit", { date: day(r.scheduled_for) }) : t("sent", { date: day(r.created_at) })}
                      </span>
                    </span>
                    <MaintenanceStatusBadge status={r.status} />
                  </summary>
                  <div className="space-y-3 pb-2 pt-3">
                    <Timeline updates={r.updates} />
                    {isOpen(r.status) && <TenantNote requestId={r.id} />}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {canRequest && (
          <Button variant="outline" size="lg" className="mt-3 w-full sm:w-auto" onClick={() => setOpen(true)}>
            <Wrench aria-hidden />
            {t("request")}
          </Button>
        )}
      </div>
      {canRequest && <RequestForm open={open} onOpenChange={setOpen} mode="tenant" contractId={contractId} />}
    </div>
  );
}

function TenantNote({ requestId }: { requestId: string }) {
  const t = useTranslations("maintenance.detail");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addMaintenanceNote({ id: requestId, note });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("noteAdded"));
    setNote("");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor={`tnote-${requestId}`}>{t("note")}</Label>
      <Textarea id={`tnote-${requestId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder={t("notePlaceholder")} />
      <Button type="submit" variant="outline" size="sm" disabled={busy || !note.trim()}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {t("addNote")}
      </Button>
    </form>
  );
}
