"use client";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MOTIVATION_TONE, motivationLevel } from "./motivation";

/** Seller motivation as icon + text + score (never color only). */
export function MotivationBadge({
  score,
  compact = false,
  className,
}: {
  score: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("market");
  const level = motivationLevel(score);
  if (level === "none" || score == null) return null;
  return (
    <Badge
      variant="secondary"
      className={cn(MOTIVATION_TONE[level].badge, "tabular", className)}
      title={t("motivation.label")}
    >
      <Zap aria-hidden />
      {compact ? score : t("motivation.badge", { level: t(`motivation.levels.${level}`), score })}
    </Badge>
  );
}
