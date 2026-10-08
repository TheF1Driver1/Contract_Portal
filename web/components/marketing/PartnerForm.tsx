"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { PARTNER_KINDS } from "@/lib/schemas";

export type PartnerCopy = {
  title: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  kind: string;
  kinds: Record<(typeof PARTNER_KINDS)[number], string>;
  clients: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  sentTitle: string;
  sentBody: string;
  error: string;
  invalid: string;
};

/** Partner-program application; copy comes from the server page (marketing locale). */
export function PartnerForm({ locale, copy }: { locale: "es" | "en"; copy: PartnerCopy }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, clients: data.clients || undefined, locale }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    setState("idle");
    setError(res?.status === 400 ? copy.invalid : copy.error);
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-xl border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">{copy.sentTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.sentBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="partner-form-title" className="space-y-4 rounded-xl border bg-surface p-5 md:p-6">
      <h2 id="partner-form-title" className="text-lg font-semibold">{copy.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-name">{copy.name}</Label>
          <Input id="p-name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-email">{copy.email}</Label>
          <Input id="p-email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-phone">{copy.phone}</Label>
          <Input id="p-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-company">{copy.company}</Label>
          <Input id="p-company" name="company" maxLength={160} autoComplete="organization" />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{copy.kind}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PARTNER_KINDS.map((k, i) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input type="radio" name="kind" value={k} required={i === 0} className="size-4 accent-primary" />
              {copy.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="p-clients">{copy.clients}</Label>
        <Input id="p-clients" name="clients" type="number" inputMode="numeric" min={0} max={100000} className="sm:w-40" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-message">{copy.message}</Label>
        <Textarea id="p-message" name="message" maxLength={2000} rows={4} placeholder={copy.messagePlaceholder} />
      </div>
      {/* Honeypot, hidden from people and assistive tech. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="p-website">Website</label>
        <input id="p-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={state === "sending"} className="w-full sm:w-auto">
        {state === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {state === "sending" ? copy.sending : copy.submit}
      </Button>
    </form>
  );
}
