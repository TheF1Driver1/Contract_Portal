"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { InspectionAckSchema, InspectionCompleteSchema, InspectionCreateSchema, InspectionDetailsSchema, InspectionItemSchema } from "@/lib/schemas";
import { defaultChecklist } from "@/lib/inspections/checklist";
import { emailTenantInspection, tenantHasLease } from "@/lib/maintenance/service";
import { todayPR } from "@/lib/rent/service";
import { rateLimitWrite } from "@/lib/rate-limit";

export type InspectionActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };

const invalid = (e: z.ZodError): InspectionActionResult => ({ ok: false, error: `Revisa el campo: ${String(e.issues[0]?.path.at(-1) ?? "")}.` });
const EXPIRED: InspectionActionResult = { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };
const NOT_FOUND: InspectionActionResult = { ok: false, error: "Inspección no encontrada." };
const LOCKED: InspectionActionResult = { ok: false, error: "La inspección ya está completada y no se puede cambiar." };

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh(contractId: string, inspectionId?: string) {
  revalidatePath(`/contracts/${contractId}`);
  if (inspectionId) revalidatePath(`/contracts/${contractId}/inspections/${inspectionId}`);
  revalidatePath("/portal");
}

/** Starts a move-in or move-out inspection with the default room checklist. */
export async function createInspection(input: unknown): Promise<InspectionActionResult> {
  const parsed = InspectionCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { contract_id, kind } = parsed.data;
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, amenities, property:properties(bathroom_count)")
    .eq("id", contract_id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!contract) return { ok: false, error: "Contrato no encontrado." };

  const { data: insp, error } = await supabase
    .from("inspections")
    .insert({ contract_id, owner_id: user.id, kind, inspected_on: todayPR() })
    .select("id")
    .single();
  if (error || !insp) {
    return { ok: false, error: error?.code === "23505" ? "Este contrato ya tiene esa inspección." : "No se pudo crear la inspección." };
  }

  const amenities = (contract.amenities ?? {}) as Record<string, unknown>;
  const property = contract.property as { bathroom_count?: number | null } | null;
  const items = defaultChecklist({ bedrooms: Number(amenities.room_count) || null, bathrooms: property?.bathroom_count ?? null });
  const { error: itemsErr } = await supabase
    .from("inspection_items")
    .insert(items.map((i) => ({ ...i, inspection_id: insp.id, owner_id: user.id })));
  if (itemsErr) {
    await supabase.from("inspections").delete().eq("id", insp.id);
    return { ok: false, error: "No se pudo preparar la lista de cotejo." };
  }
  refresh(contract_id, insp.id);
  return { ok: true, id: insp.id };
}

async function ownDraft(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, inspectionId: string) {
  const { data } = await supabase.from("inspections").select("id, contract_id, status").eq("id", inspectionId).eq("owner_id", userId).maybeSingle();
  return data;
}

export async function updateInspectionItem(input: unknown): Promise<InspectionActionResult> {
  const parsed = InspectionItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { id, ...fields } = parsed.data;
  const { data: item } = await supabase.from("inspection_items").select("inspection_id").eq("id", id).maybeSingle();
  if (!item) return NOT_FOUND;
  const insp = await ownDraft(supabase, user.id, item.inspection_id);
  if (!insp) return NOT_FOUND;
  if (insp.status !== "draft") return LOCKED;
  const patch: { condition?: string | null; note?: string | null } = {};
  if (fields.condition !== undefined) patch.condition = fields.condition;
  if (fields.note !== undefined) patch.note = fields.note || null;
  const { error } = await supabase.from("inspection_items").update(patch as never).eq("id", id);
  if (error) return { ok: false, error: "No se pudo guardar." };
  return { ok: true };
}

export async function updateInspectionDetails(input: unknown): Promise<InspectionActionResult> {
  const parsed = InspectionDetailsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const insp = await ownDraft(supabase, user.id, parsed.data.id);
  if (!insp) return NOT_FOUND;
  if (insp.status !== "draft") return LOCKED;
  const { error } = await supabase
    .from("inspections")
    .update({ inspected_on: parsed.data.inspected_on, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo guardar." };
  refresh(insp.contract_id, insp.id);
  return { ok: true };
}

/** The landlord confirms the inspection; after this it is read-only and the tenant can acknowledge it. */
export async function completeInspection(input: unknown): Promise<InspectionActionResult> {
  const parsed = InspectionCompleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confirma que revisaste la inspección." };
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const insp = await ownDraft(supabase, user.id, parsed.data.id);
  if (!insp) return NOT_FOUND;
  if (insp.status !== "draft") return LOCKED;
  const { count } = await supabase.from("inspection_items").select("id", { count: "exact", head: true }).eq("inspection_id", insp.id).is("condition", null);
  if ((count ?? 0) > 0) return { ok: false, error: "Marca la condición de cada elemento (o «No aplica») antes de completar." };

  const { error } = await supabase
    .from("inspections")
    .update({ status: "completed", landlord_signed_at: new Date().toISOString() })
    .eq("id", insp.id)
    .eq("status", "draft");
  if (error) return { ok: false, error: "No se pudo completar la inspección." };

  let warning: string | undefined;
  try {
    await emailTenantInspection(createAdminClient(), insp.id);
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "inspection tenant email failed", inspection: insp.id, err: String(e) }));
    warning = "Inspección completada, pero no se pudo avisar al inquilino por correo.";
  }
  refresh(insp.contract_id, insp.id);
  return { ok: true, id: insp.id, warning };
}

/** Discards a draft (completed inspections cannot be deleted; the database enforces it too). */
export async function deleteDraftInspection(id: string): Promise<InspectionActionResult> {
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const insp = await ownDraft(supabase, user.id, id);
  if (!insp) return NOT_FOUND;
  if (insp.status !== "draft") return LOCKED;
  const { error } = await supabase.from("inspections").delete().eq("id", id).eq("status", "draft");
  if (error) return { ok: false, error: "No se pudo descartar el borrador." };
  refresh(insp.contract_id);
  return { ok: true };
}

/**
 * Tenant confirms they reviewed a completed inspection. Records the typed
 * name, time and IP. An acknowledgment of review, not an electronic signature.
 */
export async function acknowledgeInspection(input: unknown): Promise<InspectionActionResult> {
  const parsed = InspectionAckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe tu nombre y marca la confirmación." };
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return { ok: false, error: "Demasiados intentos. Espera un minuto." };
  const admin = createAdminClient();
  const { data: insp } = await admin.from("inspections").select("id, contract_id, status, tenant_acknowledged_at").eq("id", parsed.data.id).maybeSingle();
  if (!insp || !(await tenantHasLease(admin, user.id, insp.contract_id))) return NOT_FOUND;
  if (insp.status !== "completed") return { ok: false, error: "Tu arrendador aún no ha completado esta inspección." };
  if (insp.tenant_acknowledged_at) return { ok: false, error: "Ya confirmaste esta inspección." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "").slice(0, 64) || null;
  const { error } = await admin
    .from("inspections")
    .update({ tenant_acknowledged_at: new Date().toISOString(), tenant_ack_name: parsed.data.name, tenant_ack_ip: ip })
    .eq("id", insp.id)
    .is("tenant_acknowledged_at", null);
  if (error) return { ok: false, error: "No se pudo guardar tu confirmación." };
  revalidatePath(`/portal/inspections/${insp.id}`);
  refresh(insp.contract_id, insp.id);
  return { ok: true };
}
