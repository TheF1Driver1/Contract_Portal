export type MotivationLevel = "high" | "moderate" | "mild" | "none";

/** Bucket a 0-100 seller motivation (desperation) score. */
export function motivationLevel(score: number | null | undefined): MotivationLevel {
  if (score == null || score <= 0) return "none";
  if (score >= 61) return "high";
  if (score >= 41) return "moderate";
  if (score >= 21) return "mild";
  return "none";
}

/** Token classes per level (soft background + strong text). */
export const MOTIVATION_TONE: Record<MotivationLevel, { badge: string; text: string; fill: string }> = {
  high: { badge: "bg-danger-soft text-danger", text: "text-danger", fill: "bg-danger" },
  moderate: { badge: "bg-warning-soft text-warning", text: "text-warning", fill: "bg-warning" },
  mild: { badge: "bg-info-soft text-info", text: "text-info", fill: "bg-info" },
  none: { badge: "bg-surface-muted text-muted-foreground", text: "text-muted-foreground", fill: "bg-subtle-foreground" },
};
