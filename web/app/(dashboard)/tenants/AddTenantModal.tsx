"use client";

import { TenantFormSheet } from "@/components/tenants/TenantFormSheet";

/** Create-tenant sheet. */
export default function AddTenantModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <TenantFormSheet open={open} onOpenChange={onOpenChange} />;
}
