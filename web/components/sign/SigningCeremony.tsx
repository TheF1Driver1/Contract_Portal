"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Check, CheckCircle2, ExternalLink, FileSignature, Loader2, Mail, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignaturePad from "@/components/SignaturePad";
import { LeaseHelp } from "./LeaseHelp";
import { cn } from "@/lib/utils";

type Props = {
  token: string;
  lang: "es" | "en";
  inPerson: boolean;
  /** AI lease help on the review step (AI_LEASE_HELP). */
  leaseHelp?: boolean;
  signer: { name: string; role: "tenant" | "co_tenant" | "guarantor"; status: string; consented: boolean; verified: boolean; email: string | null; phone: string | null };
  contract: { propertyLabel: string; landlord: string; leaseStart: string; leaseEnd: string; months: number; rent: number; deposit: number; sealed: boolean; status: string };
};

type Step = 1 | 2 | 3 | 4 | "done" | "declined";

/** Renders a typed name as a signature image (PNG data URL). */
function typedSignature(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.textBaseline = "middle";
  let size = 56;
  do {
    ctx.font = `italic ${size}px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;
    size -= 2;
  } while (ctx.measureText(name).width > canvas.width - 40 && size > 20);
  ctx.fillText(name, 20, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

export function SigningCeremony({ token, lang, inPerson, leaseHelp = false, signer, contract }: Props) {
  const t = useTranslations("sign");
  const tc = useTranslations("common");
  const f = useFormatter();
  const initial: Step =
    signer.status === "signed" ? "done" : signer.status === "declined" ? "declined" : !signer.consented ? 1 : !signer.verified ? 2 : 3;
  const [step, setStep] = useState<Step>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [read, setRead] = useState(false);
  const [mode, setMode] = useState<"drawn" | "typed">("drawn");
  const [drawn, setDrawn] = useState("");
  const [typed, setTyped] = useState(signer.name);
  const [intent, setIntent] = useState(false);
  const [sealed, setSealed] = useState(contract.sealed);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new step's heading for screen readers and keyboards.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : t("generic"));
      return json as Record<string, unknown>;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const day = (d: string) => f.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" });
  const docUrl = `/api/sign/${token}/document`;
  const otherLang = lang === "es" ? "en" : "es";

  const steps = [t("steps.consent"), t("steps.verify"), t("steps.review"), t("steps.sign")];
  const current = typeof step === "number" ? step : 4;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSignature className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">ContractOS</p>
            {contract.landlord && <p className="truncate text-xs text-muted-foreground">{t("header.from", { landlord: contract.landlord })}</p>}
          </div>
          <a href={`?lang=${otherLang}${inPerson ? "&p=1" : ""}`} hrefLang={otherLang} className="text-sm text-muted-foreground hover:text-foreground">
            {t("header.language")}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-28">
        {/* Summary */}
        <section aria-labelledby="summary-title" className="rounded-xl border bg-surface p-4 md:p-5">
          <h2 id="summary-title" className="text-sm font-semibold">{t("summary.title")}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t("summary.property")}</dt>
              <dd>{contract.propertyLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("summary.term")}</dt>
              <dd>{day(contract.leaseStart)} – {day(contract.leaseEnd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("summary.rent")}</dt>
              <dd className="tabular font-semibold">{f.number(contract.rent, "money")}</dd>
            </div>
            {contract.deposit > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("summary.deposit")}</dt>
                <dd className="tabular">{f.number(contract.deposit, "money")}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">{t("summary.you")}</dt>
              <dd>{signer.name} · {t(`summary.role.${signer.role}`)}</dd>
            </div>
          </dl>
        </section>

        {/* Progress */}
        {typeof step === "number" && (
          <nav aria-label={t("steps.progress", { n: current })}>
            <p className="mb-2 text-xs text-muted-foreground">{t("steps.progress", { n: current })}</p>
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((label, i) => (
                <li key={label} className="space-y-1" aria-current={i + 1 === current ? "step" : undefined}>
                  <span className={cn("block h-1.5 rounded-full", i + 1 <= current ? "bg-primary" : "bg-surface-muted")} />
                  <span className={cn("block truncate text-xs", i + 1 === current ? "font-medium text-foreground" : "text-subtle-foreground")}>{label}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <section className="rounded-xl border bg-surface p-4 md:p-5" aria-live="polite">
          {step === 1 && (
            <div className="space-y-4">
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{t("consent.title")}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{t("consent.text")}</p>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                <span>{t("consent.agree")}</span>
              </label>
              <Button
                className="h-11 w-full"
                disabled={!agree || busy}
                onClick={async () => {
                  if (await call({ action: "consent", text: t("consent.text") })) setStep(2);
                }}
              >
                {busy && <Loader2 className="animate-spin" />} {t("consent.continue")}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{t("verify.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("verify.description")}</p>
              {inPerson && <p className="rounded-md bg-info-soft p-3 text-sm text-info">{t("verify.inPerson")}</p>}
              {!sentTo ? (
                <div className="grid gap-2">
                  {signer.phone && (
                    <Button variant="outline" className="h-11 justify-start" disabled={busy} onClick={async () => {
                      const r = await call({ action: "send_code", channel: "sms" });
                      if (r) setSentTo(String(r.to));
                    }}>
                      <MessageSquare /> {t("verify.bySms", { to: signer.phone })}
                    </Button>
                  )}
                  {signer.email && (
                    <Button variant="outline" className="h-11 justify-start" disabled={busy} onClick={async () => {
                      const r = await call({ action: "send_code", channel: "email" });
                      if (r) setSentTo(String(r.to));
                    }}>
                      <Mail /> {t("verify.byEmail", { to: signer.email })}
                    </Button>
                  )}
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await call({ action: "verify", code })) setStep(3);
                  }}
                >
                  <p className="text-sm">{t("verify.sentTo", { to: sentTo })}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="otp">{t("verify.code")}</Label>
                    <Input
                      id="otp"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      className="h-12 text-center text-2xl tracking-[0.5em] tabular"
                      required
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={code.length !== 6 || busy}>
                    {busy && <Loader2 className="animate-spin" />} {t("verify.verify")}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => { setSentTo(null); setCode(""); }}>
                    {t("verify.resend")}
                  </Button>
                </form>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{t("review.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("review.description")}</p>
              <iframe src={docUrl} title={t("review.frameTitle")} className="hidden h-[70vh] w-full rounded-md border md:block" />
              <Button variant="outline" asChild className="h-11 w-full">
                <a href={docUrl} target="_blank" rel="noopener">
                  <ExternalLink /> {t("review.open")}
                </a>
              </Button>
              {leaseHelp && <LeaseHelp token={token} lang={lang} />}
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <Checkbox checked={read} onCheckedChange={(v) => setRead(v === true)} className="mt-0.5" />
                <span>{t("review.read")}</span>
              </label>
              <Button className="h-11 w-full" disabled={!read} onClick={() => setStep(4)}>
                {t("review.continue")}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{t("sign.title")}</h1>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "drawn" | "typed")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="drawn">{t("sign.draw")}</TabsTrigger>
                  <TabsTrigger value="typed">{t("sign.type")}</TabsTrigger>
                </TabsList>
                <TabsContent value="drawn" className="pt-3">
                  <SignaturePad label={t("sign.signatureLabel")} value={drawn} onChange={setDrawn} />
                </TabsContent>
                <TabsContent value="typed" className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="typed">{t("sign.typedLabel")}</Label>
                    <Input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" />
                  </div>
                  {typed.trim() && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">{t("sign.typedHint")}</p>
                      <p className="rounded-md border border-dashed border-border-strong bg-white px-4 py-3 font-serif text-3xl italic text-black">{typed}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <Checkbox checked={intent} onCheckedChange={(v) => setIntent(v === true)} className="mt-0.5" />
                <span>{t("sign.intent")}</span>
              </label>
              <Button
                className="h-12 w-full text-base"
                disabled={!intent || busy || (mode === "drawn" ? !drawn : !typed.trim())}
                onClick={async () => {
                  const signature = mode === "drawn" ? drawn : typedSignature(typed.trim());
                  const r = await call({ action: "sign", signature, method: mode, typedName: mode === "typed" ? typed.trim() : undefined, intent: true });
                  if (r) {
                    setSealed(Boolean(r.sealed));
                    setStep("done");
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Check />} {t("sign.submit")}
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center" role="status">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{t("done.title")}</h1>
              <p className="text-sm text-muted-foreground">{sealed ? t("done.sealed") : t("done.waiting")}</p>
              {sealed && (
                <Button variant="outline" asChild>
                  <a href={docUrl} target="_blank" rel="noopener">{t("done.download")}</a>
                </Button>
              )}
              {!inPerson && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">{t("done.portal")}</p>
                  <Button variant="link" asChild>
                    <Link href="/signup">{t("done.portalCta")}</Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === "declined" && (
            <div className="space-y-3 text-center" role="status">
              <XCircle className="mx-auto size-10 text-danger" aria-hidden />
              <h1 ref={headingRef} tabIndex={-1} className="text-sm font-normal outline-none">{t("decline.declined")}</h1>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          )}
        </section>

        {typeof step === "number" && (
          <p className="text-center">
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setDeclineOpen(true)}>
              {t("decline.link")}
            </button>
          </p>
        )}
      </main>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("decline.title")}</DialogTitle>
            <DialogDescription>{t("decline.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decline-reason">{t("decline.reason")}</Label>
            <Textarea id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (await call({ action: "decline", reason })) {
                  setDeclineOpen(false);
                  setStep("declined");
                }
              }}
            >
              {t("decline.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
