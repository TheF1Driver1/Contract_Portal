"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import {
  MaintenanceCreateSchema,
  MaintenanceExpenseSchema,
  MaintenanceNoteSchema,
  MaintenanceUpdateSchema,
  PhotoRegisterSchema,
  PhotoUploadRequestSchema,
} from "@/lib/schemas";
import type { MaintenanceRequest, MaintenanceStatus } from "@/lib/db";
import { canTransition, checkPhoto, isPhotoPathFor, MAX_PHOTOS_PER_RECORD, notifiesTenant, PHOTO_BUCKET, photoPath } from "@/lib/maintenance/logic";
import { emailLandlordNewRequest, emailTenantStatus, requestRole, tenantHasLease } from "@/lib/maintenance/service";
import { rateLimitWrite } from "@/lib/rate-limit";

export type MaintenanceActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };
export type UploadTicket = { ok: true; path: string; token: string } | { ok: false; error: string };

const invalid = (e: z.ZodError): MaintenanceActionResult => ({ ok: false, error: `Revisa el campo: ${String(e.issues[0]?.path.at(-1) ?? "")}.` });
const EXPIRED = { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." } as const;
const NOT_FOUND = { ok: false, error: "Solicitud no encontrada." } as const;
const TOO_MANY = { ok: false, error: "Demasiados intentos. Espera un minuto." } as const;

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh(id?: string) {
  revalidatePath("/maintenance");
  if (id) revalidatePath(`/maintenance/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

/** Landlord files a request on one of their leases. */
export async function createMaintenanceRequest(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = MaintenanceCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { contract_id, ...values } = parsed.data;
  const { data: contract } = await supabase.from("contracts").select("id, property_id").eq("id", contract_id).eq("owner_id", user.id).maybeSingle();
  if (!contract) return { ok: false, error: "Contrato no encontrado." };

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      ...values,
      description: values.description || null,
      contract_id,
      property_id: contract.property_id,
      owner_id: user.id,
      submitted_by: user.id,
      submitted_by_kind: "landlord",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo crear la solicitud." };
  await supabase.from("maintenance_updates").insert({ request_id: data.id, owner_id: user.id, author_kind: "landlord", status_change: "open" });
  refresh(data.id);
  return { ok: true, id: data.id };
}

/** Tenant files a request from the portal for a lease they redeemed an invite for. */
export async function createTenantMaintenanceRequest(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = MaintenanceCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return TOO_MANY;
  const admin = createAdminClient();
  const { contract_id, ...values } = parsed.data;
  if (!(await tenantHasLease(admin, user.id, contract_id))) return { ok: false, error: "Contrato no encontrado." };
  const { data: contract } = await admin.from("contracts").select("id, owner_id, property_id, status").eq("id", contract_id).maybeSingle();
  if (!contract || contract.status !== "signed") return { ok: false, error: "Solo puedes pedir reparaciones en un contrato firmado." };

  const { data, error } = await admin
    .from("maintenance_requests")
    .insert({
      ...values,
      description: values.description || null,
      contract_id,
      property_id: contract.property_id,
      owner_id: contract.owner_id,
      submitted_by: user.id,
      submitted_by_kind: "tenant",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo enviar la solicitud." };
  await admin.from("maintenance_updates").insert({ request_id: data.id, owner_id: contract.owner_id, author_kind: "tenant", status_change: "open" });

  let warning: string | undefined;
  try {
    await emailLandlordNewRequest(admin, data.id);
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "maintenance landlord email failed", request: data.id, err: String(e) }));
    warning = "Solicitud enviada. No pudimos avisarle por correo a tu arrendador.";
  }
  refresh(data.id);
  return { ok: true, id: data.id, warning };
}

/** Landlord changes status, vendor, schedule or cost; logs the timeline and emails the tenant when it matters. */
export async function updateMaintenanceRequest(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = MaintenanceUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { id, status, note, ...fields } = parsed.data;
  const { data: current } = await supabase.from("maintenance_requests").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!current) return NOT_FOUND;
  const cur = current as MaintenanceRequest;

  const changingStatus = status && status !== cur.status;
  if (changingStatus && !canTransition(cur.status, status)) return { ok: false, error: "Ese cambio de estado no está permitido." };

  const patch: Partial<MaintenanceRequest> = {};
  if (fields.vendor_name !== undefined) patch.vendor_name = fields.vendor_name || null;
  if (fields.vendor_phone !== undefined) patch.vendor_phone = fields.vendor_phone || null;
  if (fields.scheduled_for !== undefined) patch.scheduled_for = fields.scheduled_for || null;
  if (fields.cost !== undefined && !cur.expense_id) patch.cost = fields.cost ?? null;
  if (fields.urgency) patch.urgency = fields.urgency;
  if (changingStatus) {
    patch.status = status;
    patch.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", id);
    if (error) return { ok: false, error: "No se pudo guardar." };
  }
  if (changingStatus || note) {
    await supabase.from("maintenance_updates").insert({
      request_id: id,
      owner_id: user.id,
      author_kind: "landlord",
      status_change: changingStatus ? (status as MaintenanceStatus) : null,
      note: note || null,
    });
  }

  let warning: string | undefined;
  if (changingStatus && notifiesTenant(status as MaintenanceStatus) && cur.contract_id) {
    try {
      await emailTenantStatus(createAdminClient(), id, status as MaintenanceStatus);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "maintenance tenant email failed", request: id, err: String(e) }));
      warning = "Guardado, pero no se pudo avisar al inquilino por correo.";
    }
  }
  refresh(id);
  return { ok: true, id, warning };
}

/** A note on the timeline, from the landlord or the tenant of the lease. */
export async function addMaintenanceNote(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = MaintenanceNoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return TOO_MANY;
  const admin = createAdminClient();
  const access = await requestRole(admin, user.id, parsed.data.id);
  if (!access) return NOT_FOUND;
  // Access verified above; the service role writes for both sides.
  const { error } = await admin.from("maintenance_updates").insert({
    request_id: access.request.id,
    owner_id: access.request.owner_id,
    author_kind: access.role,
    note: parsed.data.note,
  });
  if (error) return { ok: false, error: "No se pudo añadir la nota." };
  refresh(access.request.id);
  return { ok: true };
}

/** Turns the repair cost into a property expense (once) and links it. */
export async function recordMaintenanceExpense(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = MaintenanceExpenseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { id, amount, expense_date, category } = parsed.data;
  const { data: req } = await supabase.from("maintenance_requests").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!req) return NOT_FOUND;
  const r = req as MaintenanceRequest;
  if (r.expense_id) return { ok: false, error: "Este costo ya está registrado como gasto." };

  const { data: expense, error } = await supabase
    .from("property_expenses")
    .insert({
      property_id: r.property_id,
      user_id: user.id,
      category,
      amount,
      expense_date,
      description: r.title.slice(0, 200),
      vendor: r.vendor_name,
      is_tax_deductible: true,
    })
    .select("id")
    .single();
  if (error || !expense) return { ok: false, error: "No se pudo registrar el gasto." };
  const { error: linkErr } = await supabase.from("maintenance_requests").update({ expense_id: expense.id, cost: amount }).eq("id", id).is("expense_id", null);
  if (linkErr) return { ok: false, error: "Gasto creado, pero no se pudo enlazar con la solicitud." };
  await supabase.from("maintenance_updates").insert({ request_id: id, owner_id: user.id, author_kind: "system", note: `expense:${expense.id}` });
  refresh(id);
  revalidatePath("/expenses");
  return { ok: true, id: expense.id };
}

// ── Photos (shared by requests and inspections) ─────────────────────────────

/** Resolves who may add a photo to a record, and under which owner folder. */
async function photoTarget(
  userId: string,
  scope: "maintenance" | "inspections",
  recordId: string,
  itemId?: string | null
): Promise<{ ownerId: string; count: number } | { error: string }> {
  const admin = createAdminClient();
  if (scope === "maintenance") {
    const access = await requestRole(admin, userId, recordId);
    if (!access) return { error: NOT_FOUND.error };
    if (access.role === "tenant" && access.request.status !== "open" && access.request.status !== "scheduled" && access.request.status !== "in_progress") {
      return { error: "Esta solicitud ya está cerrada." };
    }
    const { count } = await admin.from("maintenance_photos").select("id", { count: "exact", head: true }).eq("request_id", recordId);
    return { ownerId: access.request.owner_id, count: count ?? 0 };
  }
  // Inspections: only the landlord, only while it is a draft.
  const { data: insp } = await admin.from("inspections").select("id, owner_id, status").eq("id", recordId).maybeSingle();
  if (!insp || insp.owner_id !== userId) return { error: "Inspección no encontrada." };
  if (insp.status !== "draft") return { error: "La inspección ya está completada." };
  if (itemId) {
    const { data: item } = await admin.from("inspection_items").select("id").eq("id", itemId).eq("inspection_id", recordId).maybeSingle();
    if (!item) return { error: "Inspección no encontrada." };
  }
  const q = admin.from("inspection_photos").select("id", { count: "exact", head: true }).eq("inspection_id", recordId);
  const { count } = itemId ? await q.eq("item_id", itemId) : await q;
  return { ownerId: insp.owner_id, count: count ?? 0 };
}

/** Step 1: a one-time signed upload URL into the private bucket, after checking access, type and size. */
export async function requestPhotoUpload(input: unknown): Promise<UploadTicket> {
  const parsed = PhotoUploadRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Foto no válida." };
  const { user } = await session();
  if (!user) return EXPIRED;
  if (await rateLimitWrite(user.id)) return TOO_MANY;
  const { scope, record_id, item_id, content_type, size } = parsed.data;
  const check = checkPhoto(content_type, size);
  if (!check.ok) return { ok: false, error: check.error === "type" ? "Usa una foto JPG, PNG, WebP o HEIC." : "La foto no puede pasar de 8 MB." };
  const target = await photoTarget(user.id, scope, record_id, item_id);
  if ("error" in target) return { ok: false, error: target.error };
  if (target.count >= MAX_PHOTOS_PER_RECORD) return { ok: false, error: `Máximo ${MAX_PHOTOS_PER_RECORD} fotos.` };

  const path = photoPath(target.ownerId, scope, record_id, randomUUID(), check.ext);
  const { data, error } = await createAdminClient().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path: data.path ?? path, token: data.token };
}

/** Step 2: after the browser uploaded the file, record it on the request or inspection. */
export async function registerPhoto(input: unknown): Promise<MaintenanceActionResult> {
  const parsed = PhotoRegisterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Foto no válida." };
  const { user } = await session();
  if (!user) return EXPIRED;
  const { scope, record_id, item_id, path } = parsed.data;
  const target = await photoTarget(user.id, scope, record_id, item_id);
  if ("error" in target) return { ok: false, error: target.error };
  if (!isPhotoPathFor(path, target.ownerId, scope, record_id)) return { ok: false, error: "Foto no válida." };

  const admin = createAdminClient();
  const folder = path.slice(0, path.lastIndexOf("/"));
  const file = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed } = await admin.storage.from(PHOTO_BUCKET).list(folder, { search: file, limit: 1 });
  if (!listed?.some((o) => o.name === file)) return { ok: false, error: "No encontramos la foto subida. Intenta otra vez." };

  const { error } =
    scope === "maintenance"
      ? await admin.from("maintenance_photos").insert({ request_id: record_id, owner_id: target.ownerId, path, uploaded_by: user.id })
      : await admin.from("inspection_photos").insert({ inspection_id: record_id, item_id: item_id ?? null, owner_id: target.ownerId, path, uploaded_by: user.id });
  if (error) return { ok: false, error: "No se pudo guardar la foto." };
  if (scope === "maintenance") refresh(record_id);
  return { ok: true };
}
