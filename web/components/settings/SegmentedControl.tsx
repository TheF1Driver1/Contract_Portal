"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; icon?: LucideIcon };

/** Single-choice segmented control (radio group semantics). */
export function SegmentedControl({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full rounded-lg border border-border bg-surface-muted p-1 sm:w-auto"
    >
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(v)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:h-9 sm:flex-none",
              selected
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {l}
          </button>
        );
      })}
    </div>
  );
}
