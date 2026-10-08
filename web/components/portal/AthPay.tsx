"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelAthPayment, checkAthPayment, createAthPayment } from "@/lib/actions/athmovil";

const POLL_MS = 4000;

type Pending = { id: string; amount: number; expiresAt: string };
type Phase =
  | { kind: "idle" }
  | { kind: "form" }
  | { kind: "waiting"; pending: Pending; business: string }
  | { kind: "done"; amount: number }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

/** "Pagar con ATH Móvil" in the tenant portal: start, wait for confirmation, done. */
export function AthPay({
  contractId,
  balance,
  defaultPhone,
  business,
  pending,
}: {
  contractId: string;
  balance: number;
  defaultPhone: string;
  business: string;
  pending: Pending | null;
}) {
  const t = useTranslations("portal.ath");
  const f = useFormatter();
  const router = useRouter();
  const max = Math.min(Math.round(balance * 100) / 100, 1500);
  const [phase, setPhase] = useState<Phase>(pending ? { kind: "waiting", pending, business } : { kind: "idle" });
  const [amount, setAmount] = useState(String(max));
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const checking = useRef(false);

  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });

  const settle = useCallback(
    (res: Awaited<ReturnType<typeof checkAthPayment>>, p: Pending) => {
      if (!res.ok) return;
      if (res.status === "completed") {
        setPhase({ kind: "done", amount: res.amount || p.amount });
        router.refresh();
      } else if (res.status === "cancel") setPhase({ kind: "cancelled" });
      else if (res.status === "failed") setPhase({ kind: "failed", message: res.error ?? t("failedBody") });
    },
    [router, t]
  );

  const waitingId = phase.kind === "waiting" ? phase.pending.id : null;
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const p = phase.pending;
    const tick = async () => {
      setNow(Date.now());
      if (checking.current) return;
      checking.current = true;
      try {
        const expired = Date.now() > new Date(p.expiresAt).getTime() + 15_000;
        settle(expired ? await cancelAthPayment(p.id) : await checkAthPayment(p.id), p);
      } finally {
        checking.current = false;
      }
    };
    const poll = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingId]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1 || n > max) return void setError(t("amountRange", { max: money(max) }));
    setBusy(true);
    const res = await createAthPayment({ contract_id: contractId, amount: n, phone });
    setBusy(false);
    if (!res.ok) return void setError(res.error);
    setPhase({ kind: "waiting", pending: { id: res.id, amount: res.amount, expiresAt: res.expiresAt }, business: res.business || business });
  }

  async function cancel(p: Pending) {
    setBusy(true);
    const res = await cancelAthPayment(p.id);
    setBusy(false);
    if (!res.ok) return void setError(res.error);
    if (res.status === "open") return; // still pending; keep waiting
    settle(res, p);
  }

  if (phase.kind === "idle") {
    return (
      <Button className="w-full sm:w-auto" onClick={() => setPhase({ kind: "form" })}>
        <Smartphone aria-hidden /> {t("pay")}
      </Button>
    );
  }

  if (phase.kind === "form") {
    return (
      <form onSubmit={start} className="space-y-3 rounded-lg border p-3" aria-labelledby={`ath-title-${contractId}`}>
        <h4 id={`ath-title-${contractId}`} className="text-sm font-semibold">{t("title")}</h4>
        <p className="text-xs text-muted-foreground">{t("intro", { business })}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`ath-amount-${contractId}`}>{t("amount")}</Label>
            <Input
              id={`ath-amount-${contractId}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={max}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular"
              aria-describedby={`ath-amount-hint-${contractId}`}
            />
            <p id={`ath-amount-hint-${contractId}`} className="text-xs text-muted-foreground">{t("amountHint", { max: money(max) })}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ath-phone-${contractId}`}>{t("phone")}</Label>
            <Input
              id={`ath-phone-${contractId}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-describedby={`ath-phone-hint-${contractId}`}
            />
            <p id={`ath-phone-hint-${contractId}`} className="text-xs text-muted-foreground">{t("phoneHint")}</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="animate-spin" /> : <Smartphone aria-hidden />} {t("submit")}
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setPhase({ kind: "idle" })}>
            {t("close")}
          </Button>
        </div>
      </form>
    );
  }

  if (phase.kind === "waiting") {
    const left = Math.max(0, Math.floor((new Date(phase.pending.expiresAt).getTime() - now) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return (
      <div className="space-y-3 rounded-lg border p-3" role="status" aria-live="polite">
        <p className="flex items-start gap-2 text-sm font-medium">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          <span>{t("waiting", { amount: money(phase.pending.amount), business: phase.business })}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {t("countdown")} <span className="tabular font-medium text-foreground">{mmss}</span>
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => cancel(phase.pending)}>
          {t("cancel")}
        </Button>
      </div>
    );
  }

  if (phase.kind === "done") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success" role="status">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("done", { amount: money(phase.amount) })}</span>
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3" role="status">
      <p className="flex items-start gap-2 text-sm">
        <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <span>{phase.kind === "cancelled" ? t("cancelled") : phase.message}</span>
      </p>
      <Button variant="outline" size="sm" onClick={() => (setError(null), setPhase({ kind: "form" }))}>
        {t("retry")}
      </Button>
    </div>
  );
}
