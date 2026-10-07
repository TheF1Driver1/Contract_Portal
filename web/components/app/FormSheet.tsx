"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Create/edit forms. Slides in from the right on desktop and fills the
 * screen on phones. Put the submit button in `footer`.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const mobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          mobile ? "h-[100dvh] max-h-[100dvh] rounded-none" : wide ? "w-full sm:max-w-2xl" : "w-full sm:max-w-lg"
        )}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-5">{children}</div>
        {footer && <SheetFooter className="border-t sm:flex-row sm:justify-end">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
