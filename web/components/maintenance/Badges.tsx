"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowDown, CalendarClock, CheckCircle2, CircleDot, Minus, Siren, Wrench, XCircle } from "lucide-react";
import type { MaintenanceStatus, MaintenanceUrgency } from "@/lib/db";
import { cn } from "@/lib/utils";

const BASE = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const STATUS = {
  open: { icon: CircleDot, className: "bg-info-soft text-info" },
  scheduled: { icon: CalendarClock, className: "bg-primary-soft text-primary-soft-foreground" },
  in_progress: { icon: Wrench, className: "bg-warning-soft text-warning" },
  resolved: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  cancelled: { icon: XCircle, className: "bg-surface-muted text-muted-foreground" },
} as const;

const URGENCY = {
  low: { icon: ArrowDown, className: "bg-surface-muted text-muted-foreground" },
  normal: { icon: Minus, className: "bg-surface-muted text-muted-foreground" },
  urgent: { icon: AlertTriangle, className: "bg-warning-soft text-warning" },
  emergency: { icon: Siren, className: "bg-danger-soft text-danger" },
} as const;

/** Request status with icon and text (never color alone). */
export function MaintenanceStatusBadge({ status, className }: { status: MaintenanceStatus; className?: string }) {
  const t = useTranslations("maintenance.status");
  const s = STATUS[status] ?? STATUS.open;
  return (
    <span className={cn(BASE, s.className, className)}>
      <s.icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

export function UrgencyBadge({ urgency, className }: { urgency: MaintenanceUrgency; className?: string }) {
  const t = useTranslations("maintenance.urgency");
  const s = URGENCY[urgency] ?? URGENCY.normal;
  return (
    <span className={cn(BASE, s.className, className)}>
      <s.icon className="size-3.5" aria-hidden />
      {t(urgency)}
    </span>
  );
}
