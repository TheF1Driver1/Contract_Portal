"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, FileDown, Loader2, MoreHorizontal, Plus, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enableLedger, resendReceipt, updateLedgerSettings } from "@/lib/actions/rent";
import { cn } from "@/lib/utils";
import { PaymentSheet } from "./PaymentSheet";
import { ChargeSheet } from "./ChargeSheet";
import { VoidDialog } from "./VoidDialog";
import type { LedgerProps } from "./types";

type Entry = {
  id: string;
  kind: "rent" | "late_fee" | "other" | "payment";
  date: string;
  label: string;
  amount: number;
  voided: boolean;
  receiptSent?: boolean;
  viaAth?: boolean;
};

const firstOfMonth = (iso: string, add = 0) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + add, 1));
  return d.toISOString().slice(0, 10);
};

/** Rent ledger for one lease: turn it on, record payments, see the balance. */
export function LedgerPanel(props: LedgerProps) {
  const t = useTranslations("rent");
  const tm = useTranslations("emails.receipt.method");
  const f = useFormatter();
  const [paying, setPaying] = useState(false);
  const [charging, setCharging] = useState(false);
  const [voiding, setVoiding] = useState<{ id: string; kind: "payment" | "charge" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const date = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "medium" });
  const month = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { month: "long", year: "numeric" });

  const entries = useMemo<Entry[]>(() => {
    const charges: Entry[] = props.charges.map((c) => ({
      id: c.id,
      kind: c.kind,
      date: c.due_date,
      label: c.kind === "other" ? c.description ?? "" : t(`entries.${c.kind}`, { month: month(c.period ?? c.due_date) }),
      amount: Number(c.amount),
      voided: !!c.voided_at,
    }));
    const payments: Entry[] = props.payments.map((p) => ({
      id: p.id,
      kind: "payment",
      date: p.received_on,
      label: t("entries.payment", { method: tm(p.method) }) + (p.reference ? ` · ${p.reference}` : ""),
      amount: Number(p.amount),
      voided: !!p.voided_at,
      receiptSent: !!p.receipt_sent_at,
      viaAth: p.source === "ath_movil",
    }));
    return [...charges, ...payments].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "payment" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.charges, props.payments]);

  if (!props.ledger) return <EnableLedger {...props} />;

  const s = props.summary;
  async function resend(id: string) {
    setBusy(id);
    const res = await resendReceipt(id);
    setBusy(null);
    if (res.ok) toast.success(t("resent"));
    else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Kpi label={t("kpi.balance")} value={s.balance > 0 ? money(s.balance) : t("kpi.paid")} tone={s.balance > 0 ? undefined : "success"} />
        <Kpi label={t("kpi.overdue")} value={s.overdue > 0 ? money(s.overdue) : t("kpi.none")} tone={s.overdue > 0 ? "danger" : undefined} />
        <Kpi label={t("kpi.nextDue")} value={s.nextDue ? date(s.nextDue.date) : t("kpi.none")} sub={s.nextDue ? money(s.nextDue.amount) : undefined} />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPaying(true)}>
          <Wallet /> {t("actions.record")}
        </Button>
        <Button variant="outline" onClick={() => setCharging(true)}>
          <Plus /> {t("actions.charge")}
        </Button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t("entries.title")}</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("entries.empty")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className={cn("flex items-center gap-3 px-3 py-2 text-sm", e.voided && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("break-words", e.voided && "line-through")}>
                    {e.label}
                    {e.viaAth && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-info-soft px-1.5 py-0.5 align-middle text-xs font-medium text-info">
                        {t("entries.athBadge")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.kind === "payment" ? date(e.date) : t("entries.due", { date: date(e.date) })}
                    {e.voided && ` · ${t("entries.voided")}`}
                    {e.receiptSent && !e.voided && ` · ${t("entries.receiptSent")}`}
                  </p>
                </div>
                <span className={cn("tabular shrink-0 font-medium", e.kind === "payment" && "text-success")}>
                  {e.kind === "payment" ? "−" : ""}
                  {money(e.amount)}
                </span>
                {!e.voided ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("actions.more")} disabled={busy === e.id}>
                        {busy === e.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {e.kind === "payment" && (
                        <>
                          <DropdownMenuItem asChild>
                            <a href={`/api/payments/${e.id}/receipt`} target="_blank" rel="noopener">
                              <FileDown /> {t("actions.receipt")}
                            </a>
                          </DropdownMenuItem>
                          {props.tenantHasEmail && (
                            <DropdownMenuItem onSelect={() => resend(e.id)}>
                              <Send /> {t("actions.resend")}
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuItem variant="destructive" onSelect={() => setVoiding({ id: e.id, kind: e.kind === "payment" ? "payment" : "charge" })}>
                        <Ban /> {t("actions.void")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="size-8 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <LateFeeToggle contractId={props.contractId} initial={props.ledger.late_fees} />

      <PaymentSheet
        open={paying}
        onOpenChange={setPaying}
        contractId={props.contractId}
        suggested={s.overdue > 0 ? s.overdue : s.balance > 0 ? s.balance : props.rentAmount}
        today={props.today}
        tenantHasEmail={props.tenantHasEmail}
      />
      <ChargeSheet open={charging} onOpenChange={setCharging} contractId={props.contractId} today={props.today} />
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 text-base font-semibold", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</dd>
      {sub && <dd className="tabular text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function LateFeeToggle({ contractId, initial }: { contractId: string; initial: boolean }) {
  const t = useTranslations("rent.settings");
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center justify-between gap-3 border-t pt-3">
      <Label htmlFor="ledger-late-fees" className="font-normal">{t("lateFees")}</Label>
      <Switch
        id="ledger-late-fees"
        checked={on}
        onCheckedChange={async (v) => {
          setOn(v);
          const res = await updateLedgerSettings({ contract_id: contractId, late_fees: v });
          if (!res.ok) {
            setOn(!v);
            toast.error(res.error);
          } else toast.success(t("saved"));
        }}
      />
    </div>
  );
}

function EnableLedger(props: LedgerProps) {
  const t = useTranslations("rent.off");
  const f = useFormatter();
  const [start, setStart] = useState<"this" | "next">("this");
  const [lateFees, setLateFees] = useState(true);
  const [busy, setBusy] = useState(false);
  const month = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { month: "long", year: "numeric" });
  const thisMonth = firstOfMonth(props.today);
  const nextMonth = firstOfMonth(props.today, 1);
  const lf = props.lateFee;
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const policy = [
    lf.grace > 0 ? t("policyGrace", { days: lf.grace }) : null,
    lf.type !== "daily" && lf.fixed > 0 ? t("policyFixed", { amount: money(lf.fixed) }) : null,
    lf.type !== "fixed" && lf.daily > 0 ? t("policyDaily", { amount: money(lf.daily) }) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const hasPolicy = (lf.type !== "daily" && lf.fixed > 0) || (lf.type !== "fixed" && lf.daily > 0);

  if (props.status !== "signed") {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("notSigned")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ledger-start">{t("start")}</Label>
        <Select value={start} onValueChange={(v) => setStart(v as "this" | "next")}>
          <SelectTrigger id="ledger-start" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this">{t("thisMonth", { month: month(thisMonth) })}</SelectItem>
            <SelectItem value="next">{t("nextMonth", { month: month(nextMonth) })}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor="ledger-fees" className="font-normal">{t("lateFees")}</Label>
          <p className="text-xs text-muted-foreground">{hasPolicy ? t("lateFeesHint", { policy }) : t("noPolicy")}</p>
        </div>
        <Switch id="ledger-fees" checked={lateFees && hasPolicy} disabled={!hasPolicy} onCheckedChange={setLateFees} />
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await enableLedger({ contract_id: props.contractId, started_on: start === "this" ? thisMonth : nextMonth, late_fees: lateFees && hasPolicy });
          setBusy(false);
          if (res.ok) toast.success(t("enabled"));
          else toast.error(res.error);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t("enable")}
      </Button>
    </div>
  );
}
