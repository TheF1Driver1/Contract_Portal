"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Database, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { askDataAction } from "@/lib/actions/ai";
import type { DataToolName } from "@/lib/ai/data-tools";

const SUGGESTIONS = ["overdue", "expiring", "collected", "maintenance"] as const;

/** "Pregúntale a tus datos": read-only AI answers over the landlord's own data. */
export function AskDataPanel() {
  const t = useTranslations("ai.ask");
  const te = useTranslations("ai.errors");
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState<{ text: string; tools: DataToolName[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setQuestion(trimmed);
    setError(null);
    start(async () => {
      const res = await askDataAction({ question: trimmed });
      if (!res.ok) {
        setAnswer(null);
        setError(te(res.code));
        return;
      }
      setAnswer({ text: res.answer, tools: res.tools });
    });
  }

  return (
    <section aria-labelledby="ask-data-title" className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <h2 id="ask-data-title" className="text-base font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Label htmlFor="ask-data-question">{t("label")}</Label>
        <div className="flex gap-2">
          <Input
            id="ask-data-question"
            className="h-10"
            maxLength={300}
            placeholder={t("placeholder")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" className="h-10" disabled={pending || question.trim().length < 3}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? t("working") : t("submit")}
          </Button>
        </div>
      </form>

      <div role="group" aria-label={t("suggestionsLabel")} className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((k) => (
          <Button
            key={k}
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-full text-xs font-normal md:h-8"
            disabled={pending}
            onClick={() => ask(t(`suggestions.${k}`))}
          >
            {t(`suggestions.${k}`)}
          </Button>
        ))}
      </div>

      <div aria-live="polite">
        {error && <p className="text-sm text-danger">{error}</p>}
        {answer && (
          <div className="space-y-2 rounded-lg border bg-surface-muted p-3">
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">{answer.text}</p>
            {answer.tools.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="size-3.5" aria-hidden />
                <span>{t("toolsUsed")}:</span>
                {answer.tools.map((name) => (
                  <span key={name} className="rounded-full bg-surface px-2 py-0.5 font-medium text-foreground">
                    {t(`tools.${name}`)}
                  </span>
                ))}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
