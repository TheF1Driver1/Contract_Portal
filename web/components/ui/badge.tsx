import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASS: Record<string, string> = {
  default:     "pill-active",
  signed:      "pill-active",
  sent:        "pill-sent",
  draft:       "pill-draft",
  expired:     "pill-expired",
  secondary:   "pill-draft",
  destructive: "pill-expired",
  outline:     "pill-draft",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: string;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(VARIANT_CLASS[variant] ?? "pill-draft", className)}
      {...props}
    />
  );
}

export { Badge };
