import type { InspectionCondition, InspectionKind } from "@/lib/db";

export type PhotoVM = { id: string; url: string | null; renderable: boolean };

export type InspectionItemVM = {
  id: string;
  room: string;
  item: string;
  condition: InspectionCondition | null;
  note: string | null;
  sort: number;
  photos: PhotoVM[];
  /** Move-in condition for the same room/item, on a move-out inspection. */
  baseline: { condition: InspectionCondition | null; note: string | null } | null;
};

export type InspectionVM = {
  id: string;
  contract_id: string;
  kind: InspectionKind;
  status: "draft" | "completed";
  inspected_on: string;
  notes: string | null;
  landlord_signed_at: string | null;
  tenant_acknowledged_at: string | null;
  tenant_ack_name: string | null;
};

export type InspectionSummary = {
  id: string;
  kind: InspectionKind;
  status: "draft" | "completed";
  inspected_on: string;
  rated: number;
  total: number;
  tenant_acknowledged_at: string | null;
};
