"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_KEYS } from "./form-utils";

const PROGRESS = ["w-1/4", "w-2/4", "w-3/4", "w-full"] as const;

/** Desktop: numbered steps across the top. Phone: "Paso 2 de 4" + progress bar. */
export function Stepper({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  const t = useTranslations("builder");
  const total = STEP_KEYS.length;

  return (
    <nav aria-label={t("steps.label")}>
      <div className="md:hidden">
        <p className="text-sm font-medium text-foreground">
          {t("steps.mobile", { current: step + 1, total })}
          <span className="text-muted-foreground"> · {t(`steps.${STEP_KEYS[step]}`)}</span>
        </p>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
          aria-label={t("steps.mobile", { current: step + 1, total })}
        >
          <div className={cn("h-full rounded-full bg-primary transition-all", PROGRESS[step])} />
        </div>
      </div>

      <ol className="hidden items-center gap-2 md:flex">
        {STEP_KEYS.map((key, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={key} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-primary bg-primary-soft text-primary-soft-foreground",
                    !done && !current && "border-border-strong text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn(current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {t(`steps.${key}`)}
                  {done && <span className="sr-only"> ({t("steps.completed")})</span>}
                </span>
              </button>
              {i < total - 1 && (
                <span aria-hidden="true" className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
