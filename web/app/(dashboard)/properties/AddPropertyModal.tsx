"use client";

import { PropertyFormSheet } from "@/components/properties/PropertyFormSheet";

/** Create-property sheet. Plan-limit errors link to /settings/billing. */
export default function AddPropertyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <PropertyFormSheet open={open} onOpenChange={onOpenChange} />;
}
