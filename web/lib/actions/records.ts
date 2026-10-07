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

type Session = Awaited<ReturnType<typeof sessionClient>>;

/** Run a write with an authenticated client; maps errors to Spanish messages. */
async function withSession(
  label: string,
  write: (s: { supabase: Session["supabase"]; userId: string }) => PromiseLike<{
    data: { id: string }[] | { id: string } | null;
    error: unknown;
  }>
): Promise<ActionResult> {
  const { supabase, user } = await sessionClient();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };
  const { data, error } = await write({ supabase, userId: user.id });
  if (error) return { ok: false, error: planLimitMessage(error) ?? `No se pudo guardar ${label}.` };
  // Updates return rows via RLS; zero rows means the record isn't the caller's.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Registro no encontrado." };
  return { ok: true, id: row.id };
}

export async function createProperty(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PropertyCreateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;
  return withSession("la propiedad", ({ supabase, userId }) =>
    supabase.from("properties").insert({ ...values, owner_id: userId }).select("id").single()
  );
}

export async function updateProperty(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PropertyUpdateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;
  return withSession("la propiedad", ({ supabase }) =>
    supabase.from("properties").update(values).eq("id", id).select("id")
  );
}

export async function createTenant(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = TenantCreateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;
  return withSession("el inquilino", ({ supabase, userId }) =>
    supabase.from("tenants").insert({ ...values, owner_id: userId }).select("id").single()
  );
}

export async function updateTenant(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = TenantUpdateSchema.safeParse(blanksToNull(input));
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;
  return withSession("el inquilino", ({ supabase }) =>
    supabase.from("tenants").update(values).eq("id", id).select("id")
  );
}
