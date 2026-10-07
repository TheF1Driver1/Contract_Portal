"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase-server";
import { ContractCreateSchema } from "@/lib/schemas";
import { planLimitMessage } from "@/lib/plan-errors";

// Status, ownership and snapshots are server-owned, so the client can't send them.
const amenityValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const ContractInputSchema = ContractCreateSchema.omit({
  status: true,
  tenant_snapshot: true,
  property_snapshot: true,
  amenities: true,
}).extend({ amenities: z.record(amenityValue).optional() });

const FIELD_LABELS: Record<string, string> = {
  property_id: "propiedad",
  tenant_id: "inquilino",
  lease_start: "fecha de inicio",
  lease_end: "fecha de terminación",
  lease_months: "duración en meses",
  rent_amount: "renta mensual",
  security_deposit: "depósito",
  payment_due_day: "día de pago",
  occupant_count: "número de ocupantes",
};

const SaveContractInput = z.object({
  id: z.string().uuid().optional().nullable(),
  contract: ContractInputSchema,
  coTenants: z
    .array(z.object({ tenant_id: z.string().uuid(), signature: z.string().max(100_000).nullable() }))
    .max(10),
  sections: z
    .array(z.object({ title: z.string().max(300), body: z.string().max(20_000) }))
    .max(50),
});

// The form may hold incomplete values; the schema above is the gate.
type RawInput = z.input<typeof SaveContractInput>;
export type SaveContractInput = Omit<RawInput, "contract"> & {
  contract: { [K in keyof RawInput["contract"]]?: RawInput["contract"][K] | null };
};
export type SaveContractResult = { ok: true; id: string } | { ok: false; error: string };

const TENANT_SNAPSHOT_FIELDS = [
  "full_name", "email", "phone", "ssn_last4", "license_number", "current_address",
  "date_of_birth", "employer_name", "employer_phone", "monthly_income",
  "emergency_contact_name", "emergency_contact_phone",
] as const;

function pick<T extends Record<string, unknown>>(row: T | null | undefined, keys: readonly string[]) {
  if (!row) return null;
  return Object.fromEntries(keys.map((k) => [k, (row as Record<string, unknown>)[k] ?? null]));
}

/**
 * Create or update a contract with its co-tenants and custom sections.
 * Ownership comes from the session, status and snapshots are computed here
 * from database rows, never from what the browser sends.
 */
export async function saveContract(raw: SaveContractInput): Promise<SaveContractResult> {
  const parsed = SaveContractInput.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = String(first?.path.at(-1) ?? "");
    return { ok: false, error: `Revisa el campo: ${FIELD_LABELS[field] ?? field}.` };
  }
  const { id, contract, coTenants, sections } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };

  if (id) {
    const { data: existing } = await supabase.from("contracts").select("status").eq("id", id).maybeSingle();
    if (!existing) return { ok: false, error: "Contrato no encontrado." };
    if (existing.status === "signed") {
      return { ok: false, error: "Un contrato firmado no se puede modificar." };
    }
  }

  const fullySigned =
    !!contract.landlord_signature &&
    !!contract.tenant_signature &&
    coTenants.every((c) => !!c.signature);

  if (contract.lease_end <= contract.lease_start) {
    return { ok: false, error: "La fecha de terminación debe ser posterior a la de inicio." };
  }

  // Snapshots from the rows this user can actually read (RLS).
  const [{ data: property }, { data: tenant }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).maybeSingle(),
    supabase.from("tenants").select("*").eq("id", contract.tenant_id).maybeSingle(),
  ]);
  if (!property) return { ok: false, error: "Propiedad no encontrada." };
  if (!tenant) return { ok: false, error: "Inquilino no encontrado." };

  const amenities = contract.amenities ?? {};
  const row = {
    ...contract,
    owner_id: user.id,
    status: fullySigned ? "signed" : "draft",
    signed_at: fullySigned ? new Date().toISOString() : null,
    property_snapshot: {
      ...pick(property, ["name", "address", "unit", "city", "state", "zip", "country", "unit_count", "parking_count"]),
      bathroom_count: property.bathroom_count ?? amenities.bathroom_count ?? null,
      parking_available: property.parking_available ?? amenities.parking ?? null,
    },
    tenant_snapshot: pick(tenant, TENANT_SNAPSHOT_FIELDS),
  };

  let contractId = id ?? null;
  if (contractId) {
    const { error } = await supabase.from("contracts").update(row).eq("id", contractId);
    if (error) return { ok: false, error: planLimitMessage(error) ?? "No se pudo guardar el contrato." };
  } else {
    const { data: created, error } = await supabase.from("contracts").insert(row).select("id").single();
    if (error || !created) {
      return { ok: false, error: (error && planLimitMessage(error)) ?? "No se pudo guardar el contrato." };
    }
    contractId = created.id as string;
  }

  // Co-tenants: replace, snapshotting each tenant row server-side.
  await supabase.from("contract_occupants").delete().eq("contract_id", contractId).eq("role", "co_tenant");
  if (coTenants.length > 0) {
    const { data: coRows } = await supabase
      .from("tenants")
      .select("*")
      .in("id", coTenants.map((c) => c.tenant_id));
    const byId = new Map((coRows ?? []).map((t) => [t.id as string, t]));
    const occupants = coTenants
      .filter((c) => byId.has(c.tenant_id))
      .map((c) => {
        const t = byId.get(c.tenant_id)!;
        return {
          contract_id: contractId,
          owner_id: user.id,
          role: "co_tenant" as const,
          tenant_id: c.tenant_id,
          ...pick(t, ["full_name", "email", "phone", "ssn_last4", "license_number", "current_address", "date_of_birth"]),
          signature: c.signature,
          signed_at: c.signature ? new Date().toISOString() : null,
          snapshot: pick(t, TENANT_SNAPSHOT_FIELDS),
        };
      });
    if (occupants.length > 0) {
      const { error } = await supabase.from("contract_occupants").insert(occupants);
      if (error) return { ok: false, error: "No se pudieron guardar los co-inquilinos." };
    }
  }

  // Custom sections: full replace.
  await supabase.from("contract_custom_sections").delete().eq("contract_id", contractId);
  if (sections.length > 0) {
    const { error } = await supabase.from("contract_custom_sections").insert(
      sections.map((s, i) => ({ contract_id: contractId, owner_id: user.id, title: s.title, body: s.body, order_index: i }))
    );
    if (error) return { ok: false, error: "No se pudieron guardar las cláusulas." };
  }

  return { ok: true, id: contractId };
}
