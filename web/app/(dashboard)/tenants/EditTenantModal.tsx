"use client";

import { TenantFormSheet } from "@/components/tenants/TenantFormSheet";
import type { Tenant } from "@/lib/types";

/** Edit-tenant sheet. Remount with `key={tenant.id}` to reset the form. */
export default function EditTenantModal({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <TenantFormSheet tenant={tenant} open={open} onOpenChange={onOpenChange} />;
}
