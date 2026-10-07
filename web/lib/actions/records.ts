"use server";

import type { z } from "zod";
import { createClient } from "@/lib/supabase-server";
import {
  PropertyCreateSchema,
  PropertyUpdateSchema,
  TenantCreateSchema,
  TenantUpdateSchema,
} from "@/lib/schemas";
import { planLimitMessage } from "@/lib/plan-errors";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

/** Forms send "" for empty inputs; store those as null. */
function blanksToNull(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
  );
}

function invalid(error: z.ZodError): ActionResult {
  const field = String(error.issues[0]?.path.at(-1) ?? "");
  return { ok: false, error: `Revisa el campo: ${field}.` };
}

async function sessionClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function insertOwned(table: "properties" | "tenants", values: Record<string, unknown>, label: string): Promise<ActionResult> {
  const { supabase, user } = await sessionClient();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };
  const { data, error } = await supabase
    .from(table)
    .insert({ ...values, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: (error && planLimitMessage(error)) ?? `No se pudo guardar ${label}.` };
  }
  return { ok: true, id: data.id as string };
}

async function updateOwned(table: "properties" | "tenants", id: string, values: Record<string, unknown>, label: string): Promise<ActionResult> {
  const { supabase, user } = await sessionClient();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };
  // RLS limits this to the caller's rows; zero rows means not theirs.
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id");
  if (error) return { ok: false, error: `No se pudo guardar ${label}.` };
  if (!data?.length) return { ok: false, error: "Registro no encontrado." };
  return { ok: true, id };
}

export async function createProperty(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PropertyCreateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  return insertOwned("properties", parsed.data, "la propiedad");
}

export async function updateProperty(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PropertyUpdateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  return updateOwned("properties", id, parsed.data, "la propiedad");
}

export async function createTenant(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = TenantCreateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  return insertOwned("tenants", parsed.data, "el inquilino");
}

export async function updateTenant(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = TenantUpdateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  return updateOwned("tenants", id, parsed.data, "el inquilino");
}
