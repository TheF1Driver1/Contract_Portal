"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Languages, Loader2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { translateClauseAction } from "@/lib/actions/ai";
import { GLOSSARY } from "@/lib/ai/glossary";

type Draft = { target: "en" | "es"; title: string; body: string; notes: string[] };

/**
 * "Traducir al inglés / al español" for one custom clause. Shows the AI draft
 * next to the original; the landlord edits it and accepts (handing it to the
 * caller's edit form) or discards it. Nothing is saved here.
 */
export function ClauseTranslate({
  title,
  body,
  onAccept,
}: {
  title: string;
  body: string;
  onAccept: (next: { title: string; body: string }) => void;
}) {
  const t = useTranslations("ai.translate");
  const te = useTranslations("ai.errors");
  const id = useId();
  const [pending, start] = useTransition();
  const [busyTarget, setBusyTarget] = useState<"en" | "es" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function run(target: "en" | "es") {
    setBusyTarget(target);
    start(async () => {
      const res = await translateClauseAction({ title, body, target });
      setBusyTarget(null);
      if (!res.ok) {
        toast.error(te(res.code));
        return;
      }
      setDraft({ target, title: res.title, body: res.translation, notes: res.notes });
    });
  }

  if (!draft) {
    return (
      <div className="flex flex-wrap gap-1">
        {(["en", "es"] as const).map((target) => (
          <Button
            key={target}
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 text-muted-foreground md:h-8"
            disabled={pending}
            aria-label={t(target === "en" ? "toEnAria" : "toEsAria", { title })}
            onClick={() => run(target)}
          >
            {busyTarget === target ? <Loader2 className="animate-spin" aria-hidden /> : <Languages aria-hidden />}
            {busyTarget === target ? t("working") : t(target === "en" ? "toEn" : "toEs")}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-lg border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`${id}-title`} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Languages className="size-4 text-muted-foreground" aria-hidden />
          {t("panelTitle")}
        </h4>
        {!GLOSSARY.reviewed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">
            <TriangleAlert className="size-3.5 text-warning" aria-hidden />
            {t("glossaryPending")}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("original")}</p>
          <div className="rounded-md bg-surface-muted p-3 text-sm">
            <p className="font-semibold text-foreground">{title}</p>
            {body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{body}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("draft")}</p>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-t`} className="text-xs">{t("titleLabel")}</Label>
            <Input
              id={`${id}-t`}
              className="h-10"
              lang={draft.target}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-b`} className="text-xs">{t("bodyLabel")}</Label>
            <Textarea
              id={`${id}-b`}
              rows={5}
              lang={draft.target}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </div>
        </div>
      </div>

      {draft.notes.length > 0 && (
        <div className="rounded-md border border-dashed p-3">
          <p className="text-xs font-semibold text-foreground">{t("notes")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {draft.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-10 md:h-8"
          disabled={!draft.title.trim()}
          onClick={() => {
            onAccept({ title: draft.title.trim(), body: draft.body });
            setDraft(null);
            toast.success(t("accepted"));
          }}
        >
          <Check aria-hidden />
          {t("accept")}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-10 md:h-8" onClick={() => setDraft(null)}>
          <X aria-hidden />
          {t("discard")}
        </Button>
      </div>
    </section>
  );
}
