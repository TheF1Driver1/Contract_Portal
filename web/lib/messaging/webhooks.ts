// What the Twilio and Resend webhooks do once their signature checks out.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageStatus } from "@/lib/db";
import { emailT } from "@/lib/emails/translator";
import { advanceStatus, normalizePhone, parseKeyword } from "@/lib/messaging/inbound";

type Client = SupabaseClient<Database>;

/** Both languages in one reply: we can't know the sender's language before matching them. */
export function bilingual(key: "inbound.help" | "inbound.stopped" | "inbound.started"): string {
  return `${emailT("es").t(key)}\n${emailT("en").t(key)}`;
}

type TenantMatch = { id: string; owner_id: string };

/** Tenants (any landlord) whose phone is this number, however it was typed. */
async function tenantsByPhone(db: Client, phone: string): Promise<TenantMatch[]> {
  const { data } = await db.from("tenants").select("id, owner_id, phone").ilike("phone", `%${phone.slice(-4)}%`).limit(200);
  return (data ?? []).filter((t) => normalizePhone(t.phone) === phone).map((t) => ({ id: t.id, owner_id: t.owner_id }));
}

/**
 * Handles an inbound SMS/WhatsApp message. STOP-type keywords opt the number
 * out everywhere, START opts it back in where it had consented, HELP gets a
 * help reply. Every message from a known tenant is logged on their latest
 * contract. Returns the reply text, if any.
 */
export async function handleInbound(db: Client, params: Record<string, string>): Promise<string | undefined> {
  const from = params.From ?? "";
  const channel = from.toLowerCase().startsWith("whatsapp:") ? ("whatsapp" as const) : ("sms" as const);
  const phone = normalizePhone(from);
  if (!phone) return undefined;
  const keyword = parseKeyword(params.Body);
  const now = new Date().toISOString();
  const tenants = await tenantsByPhone(db, phone);

  if (keyword === "stop") {
    await db
      .from("messaging_consents")
      .update({ status: "opted_out", source: "inbound_stop", consented_at: now, updated_at: now })
      .eq("address", phone)
      .in("channel", ["sms", "whatsapp"]);
    // Also record the opt-out for matching tenants without a consent row yet,
    // so a later "landlord attested" consent can't override it.
    const rows = tenants.flatMap((t) =>
      (["sms", "whatsapp"] as const).map((ch) => ({
        owner_id: t.owner_id, subject_kind: "tenant" as const, subject_id: t.id, channel: ch, address: phone,
        status: "opted_out" as const, source: "inbound_stop" as const, consented_at: now, updated_at: now,
      }))
    );
    if (rows.length) await db.from("messaging_consents").upsert(rows, { onConflict: "subject_kind,subject_id,channel" });
  } else if (keyword === "start") {
    await db
      .from("messaging_consents")
      .update({ status: "opted_in", source: "inbound_start", consented_at: now, updated_at: now })
      .eq("address", phone)
      .eq("status", "opted_out")
      .in("channel", ["sms", "whatsapp"]);
  }

  // Log the message on each matching tenant's latest contract.
  const sid = params.MessageSid || params.SmsSid || "";
  for (const t of tenants) {
    const { data: contract } = await db
      .from("contracts")
      .select("id")
      .eq("tenant_id", t.id)
      .eq("owner_id", t.owner_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await db.from("message_log").insert({
      owner_id: t.owner_id,
      contract_id: contract?.id ?? null,
      direction: "inbound",
      recipient_kind: "tenant",
      recipient_id: t.id,
      channel,
      template: keyword ? `inbound_${keyword}` : "inbound",
      to_address: phone,
      body: (params.Body ?? "").slice(0, 1600),
      idempotency_key: sid ? `inbound:${sid}:${t.id}` : null,
      provider: "twilio",
      provider_id: sid || null,
      status: "received",
    });
    if (error && error.code !== "23505") console.error(JSON.stringify({ level: "error", msg: "inbound log failed", err: error.message }));
  }

  if (keyword === "help") return bilingual("inbound.help");
  // Twilio answers STOP/START on SMS itself; WhatsApp needs our reply.
  if (keyword === "stop" && channel === "whatsapp") return bilingual("inbound.stopped");
  if (keyword === "start" && channel === "whatsapp") return bilingual("inbound.started");
  return undefined;
}

const OPENED_TEMPLATES = new Set(["contract_ready_to_sign"]);

/** Applies a provider status to the matching send. Returns the stored status, or null if nothing changed. */
export async function applyStatus(
  db: Client,
  providerId: string,
  incoming: MessageStatus,
  error?: string | null
): Promise<MessageStatus | null> {
  const { data: row } = await db
    .from("message_log")
    .select("id, status, contract_id, template, direction")
    .eq("provider_id", providerId)
    .eq("direction", "outbound")
    .maybeSingle();
  if (!row) return null;
  const next = advanceStatus(row.status, incoming);
  const now = new Date().toISOString();
  if (next) {
    await db
      .from("message_log")
      .update({
        status: next,
        ...(next === "delivered" ? { delivered_at: now } : {}),
        ...(next === "read" ? { read_at: now } : {}),
        ...(next === "failed" ? { error: (error ?? "failed").slice(0, 500) } : {}),
      })
      .eq("id", row.id);
  }
  // A tenant opened the email with their contract: note it on the contract
  // (opened_at may change even on a signed contract).
  if (incoming === "read" && row.contract_id && OPENED_TEMPLATES.has(row.template)) {
    await db.from("contracts").update({ opened_at: now }).eq("id", row.contract_id).is("opened_at", null);
  }
  return next;
}
