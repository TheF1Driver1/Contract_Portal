import { cn } from "@/lib/utils";
import { MOTIVATION_TONE, motivationLevel } from "./motivation";

const SEGMENTS = 20;

/** Segmented 0-100 meter; the numeric value is always shown next to it. */
export function MotivationGauge({ score, label }: { score: number; label: string }) {
  const level = motivationLevel(score);
  const filled = Math.round((Math.min(Math.max(score, 0), 100) / 100) * SEGMENTS);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      className="flex h-2 gap-0.5"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn("h-full flex-1 first:rounded-l-full last:rounded-r-full", i < filled ? MOTIVATION_TONE[level].fill : "bg-surface-muted")}
        />
      ))}
    </div>
  );
}
