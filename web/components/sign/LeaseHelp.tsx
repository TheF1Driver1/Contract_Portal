"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Optional AI help on the review step: a plain-language summary or a question about the lease. */
export function LeaseHelp({ token, lang }: { token: string; lang: "es" | "en" }) {
  const t = useTranslations("sign.help");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sign/${token}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, lang }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok && typeof d?.answer === "string") {
      setAnswer(d.answer);
      return;
    }
    setError(res?.status === 429 ? t("errors.limit") : t("errors.failed"));
  }

  return (
    <section aria-labelledby="lease-help-title" className="space-y-3 rounded-xl border bg-surface-muted p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <MessageCircleQuestion className="size-4" aria-hidden />
        </span>
        <div>
          <h2 id="lease-help-title" className="text-sm font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <Button type="button" variant="outline" className="h-10 w-full" disabled={busy} onClick={() => void ask(null)}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        {t("summary")}
      </Button>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) void ask(question);
        }}
      >
        <Label htmlFor="lease-question">{t("questionLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id="lease-question"
            value={question}
            maxLength={300}
            placeholder={t("questionPlaceholder")}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-10"
          />
          <Button type="submit" className="h-10" disabled={busy || !question.trim()}>
            {t("ask")}
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {error && <p className="text-sm text-danger">{error}</p>}
        {answer && (
          <div className="space-y-2 rounded-lg border bg-surface p-3">
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">{answer}</p>
            <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
