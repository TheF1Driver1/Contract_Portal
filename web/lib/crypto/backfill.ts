import type { createAdminClient } from "@/lib/supabase-server";
import type { Json } from "@/lib/database.types";
import { isEncrypted, revealPii, sealPii } from "./fields";

type Admin = ReturnType<typeof createAdminClient>;
type Pii = { license_number?: string | null; date_of_birth?: string | null; date_of_birth_enc?: string | null };

/** True when a row still holds a plaintext license number or birth date. */
export function needsSealing(row: Pii | null | undefined): boolean {
  if (!row) return false;
  return (!!row.license_number && !isEncrypted(row.license_number)) || !!row.date_of_birth;
}

function resealed(row: Pii) {
  const r = revealPii(row);
  return sealPii({ license_number: r?.license_number ?? null, date_of_birth: r?.date_of_birth ?? null });
}

/** Rows with a plaintext birth date or license number (two filters; PostgREST `or` is avoided). */
async function plaintextRows(admin: Admin, table: "tenants" | "contract_occupants", limit: number) {
  const cols = "id, license_number, date_of_birth, date_of_birth_enc";
  const [dob, lic] = await Promise.all([
    admin.from(table).select(cols).not("date_of_birth", "is", null).limit(limit),
    admin.from(table).select(cols).not("license_number", "is", null).not("license_number", "like", "enc:v1:%").limit(limit),
  ]);
  const byId = new Map<string, Pii & { id: string }>();
  for (const r of [...(dob.data ?? []), ...(lic.data ?? [])]) byId.set(r.id, r);
  return [...byId.values()];
}

/**
 * One batch of the one-off encryption of existing rows. Tenants and occupants
 * are re-saved encrypted. Contract snapshots are only touched on drafts: a sent
 * or signed lease's snapshot is part of the signed agreement hash and stays as is.
 */
export async function backfillPiiBatch(admin: Admin, limit = 200) {
  const counts = { tenants: 0, occupants: 0, drafts: 0 };

  const tenants = await plaintextRows(admin, "tenants", limit);
  for (const t of tenants) {
    if (!needsSealing(t)) continue;
    const { error } = await admin.from("tenants").update(resealed(t)).eq("id", t.id);
    if (!error) counts.tenants++;
  }

  const occupants = await plaintextRows(admin, "contract_occupants", limit);
  for (const o of occupants) {
    if (!needsSealing(o)) continue;
    const { error } = await admin.from("contract_occupants").update(resealed(o)).eq("id", o.id);
    if (!error) counts.occupants++;
  }

  const { data: drafts } = await admin
    .from("contracts")
    .select("id, tenant_snapshot")
    .eq("status", "draft")
    .not("tenant_snapshot", "is", null)
    .limit(1000);
  for (const d of drafts ?? []) {
    const snap = d.tenant_snapshot as (Pii & Record<string, unknown>) | null;
    if (!needsSealing(snap)) continue;
    const { error } = await admin
      .from("contracts")
      .update({ tenant_snapshot: { ...snap, ...resealed(snap!) } as Json })
      .eq("id", d.id)
      .eq("status", "draft");
    if (!error) counts.drafts++;
    if (counts.drafts >= limit) break;
  }

  return { ...counts, done: counts.tenants + counts.occupants + counts.drafts === 0 };
}
