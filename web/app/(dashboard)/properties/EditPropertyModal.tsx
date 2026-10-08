"use client";

import { PropertyFormSheet } from "@/components/properties/PropertyFormSheet";
import type { Property } from "@/lib/types";

/** Edit-property sheet. Remount with `key={property.id}` to reset the form. */
export default function EditPropertyModal({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <PropertyFormSheet property={property} open={open} onOpenChange={onOpenChange} />;
}
