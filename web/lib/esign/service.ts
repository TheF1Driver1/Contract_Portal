/**
 * E-signature 2.0 (Plan 31). Server-only: every function uses the service-role
 * client after the caller has authorized the request (landlord session or a
 * valid signing token). Evidence goes to the append-only signature_events.
 */
import { PDFDocument } from "pdf-lib";
import type { createAdminClient } from "@/lib/supabase-server";
import type { Contract, Profile } from "@/lib/types";
import type { ContractSigner } from "@/lib/db";
import { renderContractPdf, type PdfSignature } from "@/lib/pdf-react";
import { emailLayout } from "@/lib/emails/layout";
import { emailT } from "@/lib/emails/translator";
import { sendResendEmail, sendTwilioSms } from "@/lib/notify";
import { getPlan, hasFeature } from "@/lib/entitlements";
import { sendMessage } from "@/lib/messaging";
import { agreementHash, hashOtp, hashToken, newOtp, newToken, safeEqualHex, sha256Hex } from "./crypto";
import { renderCertificate } from "./certificate";

type Admin = ReturnType<typeof createAdminClient>;

export const BUCKET = "signed-documents";
export const TOKEN_TTL_DAYS = 7;
const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const MAX_SIGNATURE_BYTES = 400_000;

export type Meta = { ip: string | null; userAgent: string | null };

export function requestMeta(req: Request): Meta {
  const fwd = req.headers.get("x-forwarded-for");
  return {
    ip: (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || null,
    userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
  };
}

export class SignError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

export async function logEvent(
  admin: Admin,
  e: { contractId: string; signerId?: string | null; event: string; actor?: string | null; meta?: Meta; documentSha256?: string | null; detail?: Record<string, unknown> }
) {
  const { error } = await admin.from("signature_events").insert({
    contract_id: e.contractId,
    signer_id: e.signerId ?? null,
    event: e.event,
    actor: e.actor ?? null,
    ip: e.meta?.ip ?? null,
    user_agent: e.meta?.userAgent ?? null,
    document_sha256: e.documentSha256 ?? null,
    detail: e.detail ?? {},
  });
  if (error) throw new Error(`evidence log failed: ${error.message}`);
}

// ─── Agreement loading ──────────────────────────────────────────────────────

type Agreement = {
  contract: Contract & { document_sha256: string | null; sealed_pdf_path: string | null; status: string };
  clauses: { title: string; body: string }[];
  profile: Profile | null;
  hash: string;
  propertyLabel: string;
};

export async function loadAgreement(admin: Admin, contractId: string): Promise<Agreement> {
  const { data: contract } = await admin
    .from("contracts")
    .select("*, tenant:tenants(*), property:properties(*), occupants:contract_occupants(*)")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) throw new SignError("not_found", 404);
  const [{ data: clauses }, { data: profile }] = await Promise.all([
    admin.from("contract_custom_sections").select("title, body").eq("contract_id", contractId).order("order_index"),
    admin.from("profiles").select("*").eq("id", contract.owner_id).maybeSingle(),
  ]);
  const c = contract as unknown as Agreement["contract"];
  const snap = (c.property_snapshot ?? c.property ?? null) as { name?: string; address?: string; city?: string } | null;
  return {
    contract: c,
    clauses: clauses ?? [],
    profile: (profile as Profile | null) ?? null,
    hash: agreementHash(c as unknown as Record<string, unknown>, clauses ?? []),
    propertyLabel: [snap?.name, snap?.address, snap?.city].filter(Boolean).join(", "),
  };
}

const landlordName = (p: Profile | null) => (p?.company_name || p?.full_name || p?.email || "").trim();

// ─── Requesting signatures ──────────────────────────────────────────────────

/** Contract statuses from which a signature can be requested. */
const REQUESTABLE = new Set(["draft", "sent"]);

export async function requestSignatures(admin: Admin, opts: { contractId: string; ownerId: string; appUrl: string; meta: Meta }) {
  const ag = await loadAgreement(admin, opts.contractId);
  const c = ag.contract;
  if (c.owner_id !== opts.ownerId) throw new SignError("not_found", 404);
  if (!REQUESTABLE.has(c.status)) throw new SignError("not_requestable", 409);

  // Parties: primary tenant, then co-tenants, signing in that order.
  const parties: { role: ContractSigner["role"]; name: string; email: string | null; phone: string | null; locale: string; order: number }[] = [];
  const tenant = c.tenant as (Contract["tenant"] & { preferred_locale?: string | null }) | undefined;
  if (tenant) {
    parties.push({ role: "tenant", name: tenant.full_name, email: tenant.email ?? null, phone: tenant.phone ?? null, locale: tenant.preferred_locale ?? "es", order: 1 });
  }
  (c.occupants ?? [])
    .filter((o) => o.role === "co_tenant")
    .forEach((o, i) => parties.push({ role: "co_tenant", name: o.full_name, email: o.email ?? null, phone: o.phone ?? null, locale: "es", order: 2 + i }));
  if (!parties.length) throw new SignError("no_tenant", 422);
  const unreachable = parties.find((p) => !p.email && !p.phone);
  if (unreachable) throw new SignError("signer_unreachable", 422);

  // Replace any open request.
  await admin
    .from("contract_signers")
    .update({ status: "revoked" })
    .eq("contract_id", c.id)
    .in("status", ["pending", "viewed"]);

  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const created: { signer: ContractSigner; token: string }[] = [];
  for (const p of parties) {
    const token = newToken();
    const { data, error } = await admin
      .from("contract_signers")
      .insert({
        contract_id: c.id,
        owner_id: c.owner_id,
        role: p.role,
        name: p.name,
        email: p.email,
        phone: p.phone,
        locale: p.locale === "en" ? "en" : "es",
        sign_order: p.order,
        token_hash: hashToken(token),
        token_expires_at: expires,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`signer insert failed: ${error?.message}`);
    created.push({ signer: data as ContractSigner, token });
  }

  await admin
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString(), document_sha256: ag.hash })
    .eq("id", c.id);
  await logEvent(admin, {
    contractId: c.id,
    event: "requested",
    actor: landlordName(ag.profile),
    meta: opts.meta,
    documentSha256: ag.hash,
    detail: { signers: created.map((x) => ({ id: x.signer.id, role: x.signer.role, order: x.signer.sign_order })) },
  });

  // Notify everyone in the first signing position.
  const first = Math.min(...created.map((x) => x.signer.sign_order));
  for (const x of created.filter((x) => x.signer.sign_order === first)) {
    await notifySigner(admin, x.signer, x.token, ag, opts.appUrl);
  }
  return created.map((x) => x.signer);
}

async function notifySigner(admin: Admin, signer: ContractSigner, token: string, ag: Agreement, appUrl: string) {
  const { lang, t } = emailT(signer.locale);
  const url = `${appUrl}/sign/${token}`;
  const vars = {
    name: signer.name,
    landlord: landlordName(ag.profile) || "ContractOS",
    property: ag.propertyLabel,
    url,
    date: new Date(signer.token_expires_at).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { dateStyle: "long", timeZone: "America/Puerto_Rico" }),
  };
  const channels: string[] = [];
  if (signer.email) {
    // Logged in message_log so the landlord sees delivery and when it was opened.
    const r = await sendMessage({
      db: admin,
      channel: "email",
      to: signer.email,
      template: "contract_ready_to_sign",
      locale: lang,
      vars,
      contractId: signer.contract_id,
      ownerId: signer.owner_id,
      recipient: { kind: "signer", id: signer.id },
      idempotencyKey: `sign-request:${signer.id}:${hashToken(token).slice(0, 16)}`,
    });
    if (r.status === "sent" || r.skipped === "duplicate") channels.push("email");
    else console.error(JSON.stringify({ level: "error", msg: "sign request email failed", signer: signer.id, err: r.error ?? r.skipped }));
  }
  if (signer.phone && hasFeature(await getPlan(admin, signer.owner_id), "sms")) {
    try {
      await sendTwilioSms(signer.phone, t("signRequest.sms", vars));
      channels.push("sms");
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "sign request sms failed", signer: signer.id, err: String(e) }));
    }
  }
  await logEvent(admin, { contractId: signer.contract_id, signerId: signer.id, event: "sent", actor: signer.name, detail: { channels } });
}

/** New link for a signer (resend, or in-person signing on the landlord's device). */
export async function reissueLink(admin: Admin, opts: { signerId: string; ownerId: string; appUrl: string; inPerson: boolean; notify: boolean }) {
  const { data: signer } = await admin.from("contract_signers").select("*").eq("id", opts.signerId).maybeSingle();
  if (!signer || signer.owner_id !== opts.ownerId) throw new SignError("not_found", 404);
  if (signer.status === "signed" || signer.status === "revoked") throw new SignError("not_requestable", 409);
  const token = newToken();
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const { data: updated } = await admin
    .from("contract_signers")
    .update({ token_hash: hashToken(token), token_expires_at: expires, in_person: opts.inPerson, otp_hash: null, otp_attempts: 0, verified_at: null })
    .eq("id", signer.id)
    .select("*")
    .single();
  if (opts.notify && updated) await notifySigner(admin, updated as ContractSigner, token, await loadAgreement(admin, signer.contract_id), opts.appUrl);
  return { token, url: `${opts.appUrl}/sign/${token}${opts.inPerson ? "?p=1" : ""}` };
}

export async function revokeRequests(admin: Admin, opts: { contractId: string; ownerId: string; meta: Meta }) {
  const ag = await loadAgreement(admin, opts.contractId);
  if (ag.contract.owner_id !== opts.ownerId) throw new SignError("not_found", 404);
  if (ag.contract.status === "signed") throw new SignError("already_signed", 409);
  await admin.from("contract_signers").update({ status: "revoked" }).eq("contract_id", opts.contractId).neq("status", "revoked");
  await logEvent(admin, { contractId: opts.contractId, event: "voided", actor: landlordName(ag.profile), meta: opts.meta, detail: { scope: "request" } });
}

// ─── Signer side ────────────────────────────────────────────────────────────

export type SignerSession = { signer: ContractSigner; agreement: Agreement };

/** Resolves a signing token. Throws SignError for invalid, expired or closed links. */
export async function signerFromToken(admin: Admin, token: string): Promise<SignerSession> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new SignError("invalid_link", 404);
  const { data: signer } = await admin.from("contract_signers").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!signer) throw new SignError("invalid_link", 404);
  if (signer.status === "revoked") throw new SignError("link_revoked", 410);
  const agreement = await loadAgreement(admin, signer.contract_id);
  if (agreement.contract.status === "cancelled") throw new SignError("contract_voided", 410);
  if (signer.status !== "signed" && new Date(signer.token_expires_at).getTime() < Date.now()) throw new SignError("link_expired", 410);
  return { signer: signer as ContractSigner, agreement };
}

export async function markViewed(admin: Admin, s: SignerSession, meta: Meta) {
  if (s.signer.status !== "pending") return;
  await admin.from("contract_signers").update({ status: "viewed" }).eq("id", s.signer.id);
  await logEvent(admin, { contractId: s.signer.contract_id, signerId: s.signer.id, event: "viewed", actor: s.signer.name, meta, documentSha256: s.agreement.hash });
}

export async function recordConsent(admin: Admin, s: SignerSession, meta: Meta, text: string) {
  assertOpen(s);
  await admin.from("contract_signers").update({ consented_at: new Date().toISOString() }).eq("id", s.signer.id);
  await logEvent(admin, { contractId: s.signer.contract_id, signerId: s.signer.id, event: "consented", actor: s.signer.name, meta, detail: { text } });
}

function assertOpen(s: SignerSession) {
  if (s.signer.status === "signed") throw new SignError("already_signed", 409);
  if (s.signer.status === "declined") throw new SignError("declined", 409);
  if (s.agreement.contract.status !== "sent") throw new SignError("not_open", 409);
}

const mask = (v: string) => (v.includes("@") ? v.replace(/^(.).*(@.*)$/, "$1•••$2") : `•••${v.slice(-4)}`);

export async function sendCode(admin: Admin, s: SignerSession, channel: "sms" | "email", meta: Meta) {
  assertOpen(s);
  const to = channel === "sms" ? s.signer.phone : s.signer.email;
  if (!to) throw new SignError("channel_unavailable", 422);
  const code = newOtp();
  await admin
    .from("contract_signers")
    .update({ otp_hash: hashOtp(s.signer.id, code), otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), otp_attempts: 0, otp_channel: channel })
    .eq("id", s.signer.id);
  const { lang, t } = emailT(s.signer.locale);
  const vars = { code, property: s.agreement.propertyLabel };
  if (channel === "sms") {
    await sendTwilioSms(to, t("otp.sms", vars));
  } else {
    await sendResendEmail(
      to,
      t("otp.subject", vars),
      emailLayout({ lang, heading: t("otp.heading"), paragraphs: [t("otp.body", vars)], note: t("otp.ignore"), footer: t("footerAuto") })
    );
  }
  await logEvent(admin, { contractId: s.signer.contract_id, signerId: s.signer.id, event: "otp_sent", actor: s.signer.name, meta, detail: { channel, to: mask(to) } });
  return { channel, to: mask(to) };
}

export async function verifyCode(admin: Admin, s: SignerSession, code: string, meta: Meta) {
  assertOpen(s);
  const sg = s.signer;
  if (!sg.otp_hash || !sg.otp_expires_at) throw new SignError("code_missing", 400);
  if (sg.otp_attempts >= OTP_MAX_ATTEMPTS) throw new SignError("code_locked", 429);
  if (new Date(sg.otp_expires_at).getTime() < Date.now()) throw new SignError("code_expired", 400);
  if (!safeEqualHex(sg.otp_hash, hashOtp(sg.id, code))) {
    await admin.from("contract_signers").update({ otp_attempts: sg.otp_attempts + 1 }).eq("id", sg.id);
    await logEvent(admin, { contractId: sg.contract_id, signerId: sg.id, event: "otp_failed", actor: sg.name, meta, detail: { attempt: sg.otp_attempts + 1 } });
    throw new SignError("code_wrong", 400);
  }
  await admin.from("contract_signers").update({ verified_at: new Date().toISOString(), otp_hash: null }).eq("id", sg.id);
  await logEvent(admin, { contractId: sg.contract_id, signerId: sg.id, event: "otp_verified", actor: sg.name, meta, detail: { channel: sg.otp_channel } });
}

/** Decodes a PNG data URL, enforcing type and size. */
export function decodeSignature(dataUrl: string): Buffer {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new SignError("signature_invalid", 400);
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 100 || buf.length > MAX_SIGNATURE_BYTES) throw new SignError("signature_invalid", 400);
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new SignError("signature_invalid", 400);
  return buf;
}

export async function sign(
  admin: Admin,
  s: SignerSession,
  input: { signature: string; method: "drawn" | "typed"; typedName?: string },
  meta: Meta,
  appUrl: string
) {
  assertOpen(s);
  const sg = s.signer;
  if (!sg.consented_at) throw new SignError("consent_required", 400);
  if (!sg.verified_at) throw new SignError("verification_required", 400);

  // Terms must be exactly what was requested.
  if (s.agreement.contract.document_sha256 && s.agreement.contract.document_sha256 !== s.agreement.hash) {
    throw new SignError("contract_changed", 409);
  }

  // Signers sign in order.
  const { data: all } = await admin.from("contract_signers").select("id, status, sign_order").eq("contract_id", sg.contract_id).neq("status", "revoked");
  if ((all ?? []).some((o) => o.sign_order < sg.sign_order && o.status !== "signed")) throw new SignError("not_your_turn", 409);

  const png = decodeSignature(input.signature);
  const path = `${sg.contract_id}/signatures/${sg.id}.png`;
  const up = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`signature upload failed: ${up.error.message}`);

  const signedAt = new Date().toISOString();
  await admin.from("contract_signers").update({ status: "signed", signed_at: signedAt, signature_path: path }).eq("id", sg.id);
  await logEvent(admin, {
    contractId: sg.contract_id,
    signerId: sg.id,
    event: "signed",
    actor: sg.name,
    meta,
    documentSha256: s.agreement.hash,
    detail: { method: input.method, typedName: input.typedName ?? null, inPerson: sg.in_person, signatureSha256: sha256Hex(png) },
  });

  // Next signer(s) in order.
  const remaining = (all ?? []).filter((o) => o.id !== sg.id && o.status !== "signed");
  if (remaining.length) {
    const next = Math.min(...remaining.map((o) => o.sign_order));
    if (next > sg.sign_order) {
      for (const o of remaining.filter((r) => r.sign_order === next)) {
        await reissueLink(admin, { signerId: o.id, ownerId: sg.owner_id, appUrl, inPerson: false, notify: true });
      }
    }
  }
  return maybeSeal(admin, sg.contract_id, appUrl);
}

export async function decline(admin: Admin, s: SignerSession, reason: string, meta: Meta) {
  assertOpen(s);
  await admin.from("contract_signers").update({ status: "declined", declined_reason: reason.slice(0, 1000) }).eq("id", s.signer.id);
  await logEvent(admin, { contractId: s.signer.contract_id, signerId: s.signer.id, event: "declined", actor: s.signer.name, meta, detail: { reason } });
  const owner = await admin.auth.admin.getUserById(s.signer.owner_id);
  const email = owner.data.user?.email;
  if (email) {
    await sendResendEmail(
      email,
      `${s.signer.name} rechazó firmar: ${s.agreement.propertyLabel}`,
      emailLayout({
        lang: "es",
        heading: "Firma rechazada",
        paragraphs: [`${s.signer.name} rechazó firmar el contrato de ${s.agreement.propertyLabel}.`, reason ? `Motivo: ${reason}` : ""].filter(Boolean),
        footer: "ContractOS",
      })
    ).catch(() => undefined);
  }
}

// ─── Sealing ────────────────────────────────────────────────────────────────

async function signatureDataUrl(admin: Admin, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage.from(BUCKET).download(path);
  if (!data) return null;
  return `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

/** Seals when every signer and the landlord have signed. Returns true if sealed. */
export async function maybeSeal(admin: Admin, contractId: string, appUrl: string): Promise<boolean> {
  const ag = await loadAgreement(admin, contractId);
  const c = ag.contract;
  if (c.status !== "sent" || c.sealed_pdf_path) return false;
  if (!c.landlord_signature) return false;
  const { data: signers } = await admin.from("contract_signers").select("*").eq("contract_id", contractId).neq("status", "revoked").order("sign_order");
  if (!signers?.length || signers.some((x) => x.status !== "signed")) return false;
  await seal(admin, ag, signers as ContractSigner[], appUrl);
  return true;
}

async function seal(admin: Admin, ag: Agreement, signers: ContractSigner[], appUrl: string) {
  const c = ag.contract;
  if (c.document_sha256 && c.document_sha256 !== ag.hash) throw new SignError("contract_changed", 409);

  const { data: landlordEvent } = await admin
    .from("signature_events")
    .select("created_at")
    .eq("contract_id", c.id)
    .eq("event", "landlord_signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sigBlocks: PdfSignature[] = [
    { role: "ARRENDADOR(A)", name: landlordName(ag.profile), image: c.landlord_signature ?? null, signedAt: landlordEvent?.created_at ?? null },
  ];
  for (const s of signers) {
    sigBlocks.push({
      role: s.role === "tenant" ? "ARRENDATARIO(A)" : s.role === "co_tenant" ? "CO-ARRENDATARIO(A)" : "FIADOR(A)",
      name: s.name,
      image: await signatureDataUrl(admin, s.signature_path),
      signedAt: s.signed_at,
    });
  }

  const lease = await renderContractPdf(c, ag.profile, ag.clauses, { signatures: sigBlocks });
  if (!lease) throw new Error("lease render failed");
  const leaseHash = sha256Hex(lease);
  const sealedAt = new Date().toISOString();

  const { data: events } = await admin
    .from("signature_events")
    .select("created_at, event, actor, ip, signer_id, user_agent")
    .eq("contract_id", c.id)
    .order("created_at");
  const lastSign = new Map<string, { ip: string | null; ua: string | null }>();
  for (const e of events ?? []) if (e.event === "signed" && e.signer_id) lastSign.set(e.signer_id, { ip: e.ip, ua: e.user_agent });

  const certificate = await renderCertificate({
    contractId: c.id,
    propertyLabel: ag.propertyLabel,
    agreementSha256: ag.hash,
    leasePdfSha256: leaseHash,
    sealedAt,
    landlord: { name: landlordName(ag.profile), email: ag.profile?.email ?? null, signedAt: landlordEvent?.created_at ?? null },
    signers: signers.map((s) => ({
      role: s.role,
      name: s.name,
      email: s.email,
      phone: s.phone,
      verifiedBy: s.otp_channel,
      signedAt: s.signed_at,
      ip: lastSign.get(s.id)?.ip ?? null,
      userAgent: lastSign.get(s.id)?.ua ?? null,
      inPerson: s.in_person,
    })),
    events: (events ?? []).map((e) => ({ at: e.created_at, event: e.event, actor: e.actor, ip: e.ip })),
  });

  const merged = await PDFDocument.create();
  for (const part of [lease, certificate]) {
    const doc = await PDFDocument.load(part);
    for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
  }
  merged.setTitle(`Contrato de arrendamiento firmado ${c.id.slice(-8).toUpperCase()}`);
  merged.setProducer("ContractOS");
  merged.setCreationDate(new Date(sealedAt));
  merged.setModificationDate(new Date(sealedAt));
  const sealed = Buffer.from(await merged.save());
  const sealedHash = sha256Hex(sealed);

  const path = `${c.id}/sealed/${sealedAt.replace(/[:.]/g, "-")}.pdf`;
  const up = await admin.storage.from(BUCKET).upload(path, sealed, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new Error(`sealed upload failed: ${up.error.message}`);

  const { error } = await admin
    .from("contracts")
    .update({
      status: "signed",
      signed_at: sealedAt,
      document_sha256: ag.hash,
      sealed_pdf_path: path,
      sealed_pdf_sha256: sealedHash,
      sealed_at: sealedAt,
    })
    .eq("id", c.id)
    .eq("status", "sent");
  if (error) throw new Error(`seal update failed: ${error.message}`);
  await logEvent(admin, { contractId: c.id, event: "sealed", documentSha256: ag.hash, detail: { leasePdfSha256: leaseHash, sealedPdfSha256: sealedHash, path } });

  // Everyone gets the signed copy, each in their language.
  const filename = `contrato-firmado-${c.id.slice(-8).toUpperCase()}.pdf`;
  const recipients: { email: string; locale: string; landlord: boolean; id: string }[] = signers
    .filter((s) => s.email)
    .map((s) => ({ email: s.email!, locale: s.locale, landlord: false, id: s.id }));
  const owner = await admin.auth.admin.getUserById(c.owner_id);
  if (owner.data.user?.email) recipients.push({ email: owner.data.user.email, locale: ag.profile?.locale ?? "es", landlord: true, id: c.owner_id });
  for (const r of recipients) {
    const res = await sendMessage({
      db: admin,
      channel: "email",
      to: r.email,
      template: "contract_signed",
      locale: r.locale,
      vars: { property: ag.propertyLabel, hash: sealedHash, url: r.landlord ? `${appUrl}/contracts/${c.id}` : undefined },
      contractId: c.id,
      ownerId: c.owner_id,
      recipient: { kind: r.landlord ? "landlord" : "signer", id: r.id },
      idempotencyKey: `sealed:${c.id}:${r.id}`,
      attachments: [{ filename, content: sealed }],
    });
    if (res.status === "failed") console.error(JSON.stringify({ level: "error", msg: "sealed email failed", err: res.error }));
  }
}

// ─── Void and reissue ───────────────────────────────────────────────────────

const COPY_FIELDS = [
  "owner_id", "property_id", "tenant_id", "contract_type", "unit_number", "lease_start", "lease_end", "lease_months",
  "rent_amount", "rent_amount_verbal", "security_deposit", "payment_due_day", "late_fee_day", "late_fee_type",
  "late_fee_grace_period_days", "late_fee_fixed_amount", "late_fee_daily_amount", "occupant_names", "occupant_count",
  "key_count", "amenities", "governing_law", "template_id", "template_version", "language", "engine_mode",
] as const;

/** Voids a sent or signed contract and creates an editable draft copy. Returns the new draft id. */
export async function voidAndReissue(admin: Admin, opts: { contractId: string; ownerId: string; ownerEmail: string | null; reason: string; meta: Meta }) {
  const ag = await loadAgreement(admin, opts.contractId);
  const c = ag.contract as unknown as Record<string, unknown> & { id: string; owner_id: string; status: string };
  if (c.owner_id !== opts.ownerId) throw new SignError("not_found", 404);
  if (c.status !== "signed" && c.status !== "sent") throw new SignError("not_voidable", 409);

  const { error: voidErr } = await admin
    .from("contracts")
    .update({ status: "cancelled", voided_at: new Date().toISOString(), void_reason: opts.reason.slice(0, 1000) })
    .eq("id", c.id);
  if (voidErr) throw new Error(`void failed: ${voidErr.message}`);
  await admin.from("contract_signers").update({ status: "revoked" }).eq("contract_id", c.id).in("status", ["pending", "viewed"]);
  await logEvent(admin, { contractId: c.id, event: "voided", actor: opts.ownerEmail, meta: opts.meta, detail: { reason: opts.reason } });

  const copy = Object.fromEntries(COPY_FIELDS.map((k) => [k, c[k] ?? null])) as Record<string, unknown>;
  const { data: draft, error } = await admin
    .from("contracts")
    .insert({ ...copy, status: "draft", parent_contract_id: c.id } as never)
    .select("id")
    .single();
  if (error || !draft) throw new Error(`reissue failed: ${error?.message}`);

  if (ag.clauses.length) {
    await admin.from("contract_custom_sections").insert(
      ag.clauses.map((s, i) => ({ contract_id: draft.id, owner_id: c.owner_id, title: s.title, body: s.body, order_index: i }))
    );
  }
  const { data: occupants } = await admin.from("contract_occupants").select("*").eq("contract_id", c.id);
  if (occupants?.length) {
    await admin.from("contract_occupants").insert(
      occupants.map(({ id: _id, created_at: _c, signature: _s, signed_at: _sa, ...o }) => ({ ...o, contract_id: draft.id }))
    );
  }
  await logEvent(admin, { contractId: c.id, event: "reissued", actor: opts.ownerEmail, detail: { newContractId: draft.id } });
  return draft.id as string;
}
