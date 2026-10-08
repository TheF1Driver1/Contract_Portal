"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ContactCopy = {
  name: string;
  email: string;
  company: string;
  units: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  sentTitle: string;
  sentBody: string;
  error: string;
  invalid: string;
};

/** Enterprise inquiry form; copy comes from the server page (marketing locale). */
export function ContactForm({ locale, copy }: { locale: "es" | "en"; copy: ContactCopy }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, units: data.units || undefined, locale }),
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-surface p-5 md:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-name">{copy.name}</Label>
          <Input id="c-name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-email">{copy.email}</Label>
          <Input id="c-email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-company">{copy.company}</Label>
          <Input id="c-company" name="company" maxLength={160} autoComplete="organization" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-units">{copy.units}</Label>
          <Input id="c-units" name="units" type="number" inputMode="numeric" min={0} max={100000} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-message">{copy.message}</Label>
        <Textarea id="c-message" name="message" required minLength={10} maxLength={3000} rows={5} placeholder={copy.messagePlaceholder} />
      </div>
      {/* Honeypot, hidden from people and assistive tech. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
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
