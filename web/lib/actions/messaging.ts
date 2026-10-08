"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { TenantConsentSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/messaging/inbound";
import type { ConsentSource } from "@/lib/db";

export type MessagingActionResult = { ok: true } | { ok: false; error: string };

export type ConsentView = { status: "opted_in" | "opted_out"; source: ConsentSource; at: string } | null;

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ── Landlord daily digest ────────────────────────────────────────────────────

export async function getDigestEmails(): Promise<boolean | null> {
  const { supabase, user } = await session();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("digest_emails").eq("id", user.id).maybeSingle();
  return data?.digest_emails ?? true;
}

export async function setDigestEmails(enabled: boolean): Promise<MessagingActionResult> {
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };
  const { error } = await supabase.from("profiles").update({ digest_emails: enabled === true }).eq("id", user.id);
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}

// ── Tenant SMS / WhatsApp consent ────────────────────────────────────────────

/** Current consent per channel for one of the landlord's tenants (RLS-scoped read). */
export async function getTenantConsents(tenantId: string): Promise<{ sms: ConsentView; whatsapp: ConsentView } | null> {
  const { supabase, user } = await session();
  if (!user) return null;
  const { data } = await supabase
    .from("messaging_consents")
    .select("channel, status, source, consented_at")
    .eq("subject_kind", "tenant")
    .eq("subject_id", tenantId);
  const view = (ch: "sms" | "whatsapp"): ConsentView => {
    const r = (data ?? []).find((x) => x.channel === ch);
    return r ? { status: r.status, source: r.source, at: r.consented_at } : null;
  };
  return { sms: view("sms"), whatsapp: view("whatsapp") };
}

/**
 * The landlord records that the tenant agreed (or no longer agrees) to get
 * messages by SMS or WhatsApp. A tenant who replied STOP can only opt back
 * in themselves (START), never by the landlord's word.
 */
export async function setTenantConsent(input: unknown): Promise<MessagingActionResult> {
  const parsed = TenantConsentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { tenant_id, channel, opted_in } = parsed.data;
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };

  // Ownership check through RLS before the service role writes.
  const { data: tenant } = await supabase.from("tenants").select("id, phone").eq("id", tenant_id).eq("owner_id", user.id).maybeSingle();
  if (!tenant) return { ok: false, error: "Inquilino no encontrado." };
  const phone = normalizePhone(tenant.phone);
  if (!phone) return { ok: false, error: "Añade un teléfono válido del inquilino primero." };

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("messaging_consents")
    .select("status, source, address")
    .eq("subject_kind", "tenant")
    .eq("subject_id", tenant_id)
    .eq("channel", channel)
    .maybeSingle();
  if (opted_in && current?.status === "opted_out" && current.source === "inbound_stop") {
    return { ok: false, error: "El inquilino respondió STOP. Solo puede reactivar los mensajes respondiendo START." };
  }
  if (current?.status === (opted_in ? "opted_in" : "opted_out") && current.address === phone) return { ok: true };
  if (!current && !opted_in) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await admin.from("messaging_consents").upsert(
    {
      owner_id: user.id,
      subject_kind: "tenant",
      subject_id: tenant_id,
      channel,
      address: phone,
      status: opted_in ? "opted_in" : "opted_out",
      source: "landlord_attested",
      consented_at: now,
      updated_at: now,
    },
    { onConflict: "subject_kind,subject_id,channel" }
  );
  if (error) return { ok: false, error: "No se pudo guardar el consentimiento." };
  revalidatePath("/tenants");
  return { ok: true };
}
