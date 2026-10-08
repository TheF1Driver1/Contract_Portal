"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Clock, Download, Eye, Loader2, PenLine, RotateCw, Send, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase";
import { ConfirmDialog } from "@/components/contracts/ConfirmDialog";
import { cn } from "@/lib/utils";

type Signer = {
  id: string;
  role: "tenant" | "co_tenant" | "guarantor";
  name: string;
  email: string | null;
  phone: string | null;
  sign_order: number;
  status: "pending" | "viewed" | "signed" | "declined";
  otp_channel: "sms" | "email" | null;
  signed_at: string | null;
  declined_reason: string | null;
  in_person: boolean;
};
type EventRow = { id: number; event: string; actor: string | null; created_at: string };

const STATUS = {
  pending: { icon: Clock, className: "bg-surface-muted text-muted-foreground" },
  viewed: { icon: Eye, className: "bg-info-soft text-info" },
  signed: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  declined: { icon: XCircle, className: "bg-danger-soft text-danger" },
} as const;

/** Signature requests, live status, sealed copy and evidence for a contract. */
export function SignersPanel({
  contractId,
  status,
  sealed,
  sealedSha256,
}: {
  contractId: string;
  status: string;
  sealed: boolean;
  sealedSha256: string | null;
}) {
  const t = useTranslations("contracts.esign");
  const f = useFormatter();
  const router = useRouter();
  const [signers, setSigners] = useState<Signer[] | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractId}/signers`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { signers: Signer[]; events: EventRow[] };
    setSigners(json.signers);
    setEvents(json.events);
  }, [contractId]);

  useEffect(() => {
    void load();
    // Live updates: every new evidence event refreshes the panel.
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`signature-events-${contractId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signature_events", filter: `contract_id=eq.${contractId}` }, (payload) => {
        void load();
        if ((payload.new as { event?: string }).event === "sealed") router.refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contractId, load, router]);

  async function act(key: string, url: string, init: RequestInit, ok: string, fail: string) {
    setBusy(key);
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "");
      if (ok) toast.success(ok);
      await load();
      router.refresh();
      return json as Record<string, unknown>;
    } catch (e) {
      toast.error(fail, { description: (e as Error).message || undefined });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const canRequest = status === "draft" || status === "sent";
  const open = (signers ?? []).some((s) => s.status === "pending" || s.status === "viewed");

  return (
    <div className="space-y-4">
      {sealed && (
        <div className="rounded-lg border border-success/30 bg-success-soft p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="size-4" aria-hidden /> {t("sealedTitle")}
          </p>
          {sealedSha256 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("sealedHint")} <code className="break-all font-mono">{sealedSha256}</code>
            </p>
          )}
          <Button asChild size="sm" className="mt-2">
            <a href={`/api/contracts/${contractId}/sealed`}>
              <Download /> {t("download")}
            </a>
          </Button>
        </div>
      )}

      {signers === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
        </p>
      ) : signers.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("none")}</p>
          {canRequest && (
            <Button
              onClick={() => act("send", `/api/contracts/${contractId}/signers`, { method: "POST" }, t("sent"), t("sendFailed"))}
              disabled={busy !== null}
            >
              {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} {t("send")}
            </Button>
          )}
        </div>
      ) : (
        <>
          {signers.length > 1 && <p className="text-xs text-muted-foreground">{t("order")}</p>}
          <ul className="space-y-2">
            {signers.map((s) => {
              const st = STATUS[s.status] ?? STATUS.pending;
              const Icon = st.icon;
              return (
                <li key={s.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{[s.email, s.phone].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>
                      <Icon className="size-3.5" aria-hidden /> {t(`status.${s.status}`)}
                    </span>
                  </div>
                  {s.status === "signed" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.signed_at && f.dateTime(new Date(s.signed_at), { dateStyle: "medium", timeStyle: "short" })}
                      {s.otp_channel && ` · ${t(`verifiedBy.${s.otp_channel}`)}`}
                      {s.in_person && ` · ${t("inPersonTag")}`}
                    </p>
                  )}
                  {s.status === "declined" && s.declined_reason && (
                    <p className="mt-1 text-xs text-danger">{t("declinedReason", { reason: s.declined_reason })}</p>
                  )}
                  {(s.status === "pending" || s.status === "viewed") && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => act(`resend-${s.id}`, `/api/contracts/${contractId}/signers/${s.id}/link`, json({ mode: "resend" }), t("resent"), t("sendFailed"))}
                      >
                        {busy === `resend-${s.id}` ? <Loader2 className="animate-spin" /> : <RotateCw />} {t("resend")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title={t("inPersonHint")}
                        disabled={busy !== null}
                        onClick={async () => {
                          const r = await act(`person-${s.id}`, `/api/contracts/${contractId}/signers/${s.id}/link`, json({ mode: "in_person" }), "", t("sendFailed"));
                          if (r && typeof r.url === "string") window.open(r.url, "_blank", "noopener");
                        }}
                      >
                        {busy === `person-${s.id}` ? <Loader2 className="animate-spin" /> : <Smartphone />} {t("inPerson")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {open && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
              {t("cancel")}
            </Button>
          )}
          {!open && canRequest && signers.every((s) => s.status === "declined") && (
            <Button onClick={() => act("send", `/api/contracts/${contractId}/signers`, { method: "POST" }, t("sent"), t("sendFailed"))} disabled={busy !== null}>
              <Send /> {t("send")}
            </Button>
          )}
        </>
      )}

      <div className="border-t pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium"
          aria-expanded={showTimeline}
          onClick={() => setShowTimeline((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <PenLine className="size-4 text-muted-foreground" aria-hidden /> {t("timeline")}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", showTimeline && "rotate-180")} aria-hidden />
        </button>
        {showTimeline && (
          <ol className="mt-3 space-y-2">
            {events.length === 0 && <li className="text-xs text-muted-foreground">{t("noEvents")}</li>}
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 text-xs">
                <span>
                  {t.has(`events.${e.event}`) ? t(`events.${e.event}`) : e.event}
                  {e.actor && <span className="text-muted-foreground"> · {e.actor}</span>}
                </span>
                <time dateTime={e.created_at} className="shrink-0 text-subtle-foreground tabular">
                  {f.dateTime(new Date(e.created_at), { dateStyle: "short", timeStyle: "short" })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelTitle")}
        description={t("cancelDescription")}
        confirmLabel={t("cancel")}
        onConfirm={async () => {
          await act("cancel", `/api/contracts/${contractId}/signers`, { method: "DELETE" }, t("cancelled"), t("sendFailed"));
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}
