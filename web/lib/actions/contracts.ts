"use server";

import { trackEvent } from "@/lib/analytics";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { storeSignature } from "@/lib/esign/signature-store";
import { revealPii, sealPii } from "@/lib/crypto/fields";
import { ContractCreateSchema } from "@/lib/schemas";
import { planLimitMessage } from "@/lib/plan-errors";
import type { Json } from "@/lib/database.types";

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
  "date_of_birth", "date_of_birth_enc", "employer_name", "employer_phone", "monthly_income",
  "emergency_contact_name", "emergency_contact_phone",
] as const;

function pick(row: object | null | undefined, keys: readonly string[]): { [k: string]: Json } | null {
  if (!row) return null;
  return Object.fromEntries(keys.map((k) => [k, ((row as Record<string, unknown>)[k] ?? null) as Json]));
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
    if (existing.status === "signed" || existing.status === "cancelled") {
      return { ok: false, error: "Un contrato firmado o anulado no se puede modificar. Usa «Anular y reemitir»." };
    }
    // Terms are frozen while a signature request is open (Plan 31).
    const { count } = await supabase
      .from("contract_signers")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", id)
      .in("status", ["pending", "viewed", "signed"]);
    if (count) {
      return { ok: false, error: "Este contrato tiene una solicitud de firma abierta. Cancélala para editarlo." };
    }
  }

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
  // Landlord signature image -> private storage; the row keeps a "sig:" reference.
  // Only touched when the form sent the field (undefined keeps the stored one).
  let signatureField: { landlord_signature?: string | null } = {};
  if (contract.landlord_signature !== undefined) {
    try {
      signatureField = { landlord_signature: await storeSignature(createAdminClient(), user.id, contract.landlord_signature) };
    } catch {
      return { ok: false, error: "No se pudo guardar la firma." };
    }
  }
  const row = {
    ...contract,
    ...signatureField,
    owner_id: user.id,
    // Only the verified signing flow marks a contract signed; tenants never
    // sign through this form (in-person signing also requires their code).
    status: "draft" as const,
    signed_at: null,
    tenant_signature: null,
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
    await trackEvent("contract_created");
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
          full_name: t.full_name,
          email: t.email,
          phone: t.phone,
          ssn_last4: t.ssn_last4,
          license_number: t.license_number,
          current_address: t.current_address,
          date_of_birth: t.date_of_birth,
          date_of_birth_enc: t.date_of_birth_enc,
          signature: null,
          signed_at: null,
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

// ── Renewal PII (Plan 31) ─────────────────────────────────────────────────────

type PiiSource = { full_name?: string | null; license_number?: string | null; date_of_birth?: string | null; date_of_birth_enc?: string | null };

/** Freshly sealed PII copied from a stored row (encrypted or legacy plaintext). */
function piiFrom(src: PiiSource | null | undefined) {
  const r = revealPii(src ?? {});
  return sealPii({ license_number: r?.license_number ?? null, date_of_birth: r?.date_of_birth ?? null });
}

/**
 * Renewals are created in the browser without license numbers or birth dates;
 * this fills them server-side from the tenant rows (or the previous lease), so
 * the values stay encrypted and never round-trip through the client. It also
 * moves the landlord's signature image into private storage.
 */
export async function finalizeRenewal(contractId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !z.string().uuid().safeParse(contractId).success) return { ok: false };

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status, tenant_id, tenant_snapshot, parent_contract_id, landlord_signature")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!contract || contract.status !== "draft") return { ok: false };

  const { data: occupants } = await supabase
    .from("contract_occupants")
    .select("id, tenant_id, full_name, snapshot")
    .eq("contract_id", contractId);
  const tenantIds = [contract.tenant_id, ...(occupants ?? []).map((o) => o.tenant_id)].filter((v): v is string => !!v);
  const [{ data: tenants }, { data: parent }, { data: parentOccupants }] = await Promise.all([
    supabase.from("tenants").select("id, license_number, date_of_birth, date_of_birth_enc").in("id", tenantIds.length ? tenantIds : ["00000000-0000-0000-0000-000000000000"]),
    contract.parent_contract_id
      ? supabase.from("contracts").select("tenant_snapshot").eq("id", contract.parent_contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contract.parent_contract_id
      ? supabase.from("contract_occupants").select("full_name, license_number, date_of_birth, date_of_birth_enc").eq("contract_id", contract.parent_contract_id)
      : Promise.resolve({ data: [] as PiiSource[] }),
  ]);
  const byTenant = new Map((tenants ?? []).map((t) => [t.id, t as PiiSource]));

  const primary = piiFrom(
    (contract.tenant_id && byTenant.get(contract.tenant_id)) || (parent?.tenant_snapshot as PiiSource | null)
  );
  const snapshot = { ...((contract.tenant_snapshot as Record<string, unknown> | null) ?? {}), ...primary };
  // The renewal form posts the signature as a data URL; move it to storage.
  const landlordSignature = await storeSignature(createAdminClient(), user.id, contract.landlord_signature).catch(() => contract.landlord_signature);
  const { error } = await supabase
    .from("contracts")
    .update({ tenant_snapshot: snapshot as Json, landlord_signature: landlordSignature })
    .eq("id", contractId);
  if (error) return { ok: false };

  for (const o of occupants ?? []) {
    const src = (o.tenant_id && byTenant.get(o.tenant_id)) || (parentOccupants ?? []).find((p) => p.full_name === o.full_name);
    const pii = piiFrom(src);
    await supabase
      .from("contract_occupants")
      .update({ ...pii, snapshot: { ...((o.snapshot as Record<string, unknown> | null) ?? {}), ...pii } as Json })
      .eq("id", o.id);
  }
  return { ok: true };
}
