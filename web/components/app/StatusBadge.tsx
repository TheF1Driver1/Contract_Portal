"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, FileEdit, Send, XCircle, AlertTriangle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES = {
  draft: { icon: FileEdit, className: "bg-surface-muted text-muted-foreground" },
  sent: { icon: Send, className: "bg-info-soft text-info" },
  signed: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  active: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  expired: { icon: Clock, className: "bg-warning-soft text-warning" },
  pending: { icon: Clock, className: "bg-warning-soft text-warning" },
  cancelled: { icon: XCircle, className: "bg-danger-soft text-danger" },
  failed: { icon: AlertTriangle, className: "bg-danger-soft text-danger" },
} as const;

export type Status = keyof typeof STYLES;

/** Status with icon and text, never color alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("common.status");
  const style = STYLES[status as Status] ?? { icon: CircleDot, className: "bg-surface-muted text-muted-foreground" };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style.className,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {status in STYLES ? t(status as Status) : status}
    </span>
  );
}
