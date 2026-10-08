"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Download, FilePenLine, Loader2, Sparkles } from "lucide-react";
import { FormSheet } from "@/components/app/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftNoticeAction } from "@/lib/actions/ai";
import type { NoticeKind } from "@/lib/ai/notice";

const KINDS: NoticeKind[] = ["late_payment", "renewal_offer"];

/**
 * "Redactar aviso": an AI draft of a late-payment or renewal notice for a
 * signed lease, in the tenant's language. The landlord edits, copies or
 * downloads it; there is deliberately no send button.
 */
export function NoticeDraftSheet({
  contractId,
  tenantName,
  tenantLocale,
  rentAmount,
  ledgerOverdue,
}: {
  contractId: string;
  tenantName: string;
  tenantLocale: "es" | "en";
  rentAmount: number;
  /** Past-due balance from the rent ledger, or null when the lease has none. */
  ledgerOverdue: number | null;
}) {
  const t = useTranslations("ai.notice");
  const te = useTranslations("ai.errors");
  const f = useFormatter();
  const money = (n: number) => f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoticeKind>("late_payment");
  const [amount, setAmount] = useState("");
  const [proposedRent, setProposedRent] = useState("");
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [pending, start] = useTransition();

  const num = (s: string) => (s.trim() ? Number(s) : null);

  function generate() {
    start(async () => {
      const res = await draftNoticeAction({
        contract_id: contractId,
        kind,
        amount_overdue: kind === "late_payment" && ledgerOverdue === null ? num(amount) : null,
        proposed_rent: kind === "renewal_offer" ? num(proposedRent) : null,
        proposed_term_months: kind === "renewal_offer" ? num(term) : null,
      });
      if (!res.ok) {
        toast.error(te(res.code));
        return;
      }
      setDraft({ subject: res.subject, body: res.body });
    });
  }

  const text = draft ? `${draft.subject}\n\n${draft.body}\n` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aviso-${kind}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const needsAmount = kind === "late_payment" && ledgerOverdue === null;
  const canGenerate = !pending && (!needsAmount || Number(amount) > 0);

  return (
    <>
      <Button type="button" variant="outline" className="h-10 w-full sm:h-9" onClick={() => setOpen(true)}>
        <FilePenLine aria-hidden />
        {t("open")}
      </Button>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description", { tenant: tenantName })}
        wide
        footer={
          <>
            <Button type="button" variant="ghost" className="h-10 sm:h-9" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
            <Button type="button" className="h-10 sm:h-9" disabled={!canGenerate} onClick={generate}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {pending ? t("working") : draft ? t("regenerate") : t("generate")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-foreground">{t("kindLabel")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <label
                  key={k}
                  htmlFor={`notice-kind-${k}`}
                  className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 hover:bg-surface-hover has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    id={`notice-kind-${k}`}
                    type="radio"
                    name="notice-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => {
                      setKind(k);
                      setDraft(null);
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t(`kinds.${k}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`kindHints.${k}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {kind === "late_payment" &&
            (ledgerOverdue !== null ? (
              <p className="tabular rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground">
                {t("ledgerBalance", { amount: money(ledgerOverdue) })}
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t("noLedger")}</p>
                <Label htmlFor="notice-amount">{t("amountLabel")}</Label>
                <Input
                  id="notice-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="tabular h-10 sm:max-w-48"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            ))}

          {kind === "renewal_offer" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notice-rent">{t("proposedRentLabel")}</Label>
                <Input
                  id="notice-rent"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="tabular h-10"
                  aria-describedby="notice-rent-hint"
                  value={proposedRent}
                  onChange={(e) => setProposedRent(e.target.value)}
                />
                <p id="notice-rent-hint" className="text-xs text-muted-foreground">
                  {t("proposedRentHint", { amount: money(rentAmount) })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notice-term">{t("termLabel")}</Label>
                <Input
                  id="notice-term"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  className="tabular h-10"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t("language", { language: t(`languages.${tenantLocale}`) })}</p>

          <div aria-live="polite" className="space-y-3">
            {draft && (
              <div className="space-y-3 rounded-xl border p-3">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">
                  <Sparkles className="size-3.5 text-warning" aria-hidden />
                  {t("aiLabel")}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="notice-subject">{t("subjectLabel")}</Label>
                  <Input
                    id="notice-subject"
                    className="h-10"
                    lang={tenantLocale}
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notice-body">{t("bodyLabel")}</Label>
                  <Textarea
                    id="notice-body"
                    rows={10}
                    lang={tenantLocale}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="h-10 sm:h-9" onClick={() => void copy()}>
                    <Copy aria-hidden />
                    {t("copy")}
                  </Button>
                  <Button type="button" variant="secondary" className="h-10 sm:h-9" onClick={download}>
                    <Download aria-hidden />
                    {t("download")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">{t("noSending")}</p>
        </div>
      </FormSheet>
    </>
  );
}
