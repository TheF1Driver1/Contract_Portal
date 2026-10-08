// Loads an inspection with items, photos (signed URLs) and the move-in
// baseline for a move-out. The caller must have verified access first.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Inspection, InspectionItem, InspectionPhoto } from "@/lib/db";
import { baselineMap } from "@/lib/inspections/checklist";
import { isRenderable } from "@/lib/maintenance/logic";
import { signedPhotoUrls } from "@/lib/maintenance/service";
import type { InspectionItemVM, InspectionVM } from "@/components/inspections/types";

type Client = SupabaseClient<Database>;

export async function loadInspection(
  admin: Client,
  inspectionId: string
): Promise<{ inspection: InspectionVM; items: InspectionItemVM[]; photos: InspectionPhoto[]; raw: Inspection } | null> {
  const { data } = await admin.from("inspections").select("*").eq("id", inspectionId).maybeSingle();
  if (!data) return null;
  const insp = data as Inspection;
  const [{ data: items }, { data: photos }, { data: moveIn }] = await Promise.all([
    admin.from("inspection_items").select("*").eq("inspection_id", insp.id).order("sort"),
    admin.from("inspection_photos").select("*").eq("inspection_id", insp.id).order("created_at"),
    insp.kind === "move_out"
      ? admin.from("inspections").select("id").eq("contract_id", insp.contract_id).eq("kind", "move_in").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  let baseline = new Map<string, { condition: InspectionItem["condition"]; note: string | null }>();
  if (moveIn?.id) {
    const { data: base } = await admin.from("inspection_items").select("room, item, condition, note").eq("inspection_id", moveIn.id);
    baseline = baselineMap((base ?? []) as InspectionItem[]);
  }
  const ph = (photos ?? []) as InspectionPhoto[];
  const urls = await signedPhotoUrls(admin, ph.map((p) => p.path));
  const vm: InspectionItemVM[] = ((items ?? []) as InspectionItem[]).map((i) => ({
    id: i.id,
    room: i.room,
    item: i.item,
    condition: i.condition,
    note: i.note,
    sort: i.sort,
    photos: ph.filter((p) => p.item_id === i.id).map((p) => ({ id: p.id, url: urls.get(p.path) ?? null, renderable: isRenderable(p.path) })),
    baseline: insp.kind === "move_out" ? baseline.get(`${i.room}/${i.item}`) ?? null : null,
  }));
  return {
    raw: insp,
    photos: ph,
    items: vm,
    inspection: {
      id: insp.id,
      contract_id: insp.contract_id,
      kind: insp.kind,
      status: insp.status,
      inspected_on: insp.inspected_on,
      notes: insp.notes,
      landlord_signed_at: insp.landlord_signed_at,
      tenant_acknowledged_at: insp.tenant_acknowledged_at,
      tenant_ack_name: insp.tenant_ack_name,
    },
  };
}
