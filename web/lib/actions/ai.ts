"use server";

import { getLocale } from "next-intl/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { AiAskDataSchema, AiNoticeSchema, AiTranslateSchema } from "@/lib/schemas";
import { rateLimitStrict } from "@/lib/rate-limit";
import { getPlan } from "@/lib/entitlements";
import { aiEnabled } from "@/lib/ai/client";
import { aiQuotaRemaining, recordAiUsage, type AiFeature } from "@/lib/ai/usage";
import { AiError, aiErrorCode, type AiErrorCode } from "@/lib/ai/errors";
import { translateClause } from "@/lib/ai/translate";
import { draftNotice, noticeLocale, oldestUnpaidDue, type NoticeFacts } from "@/lib/ai/notice";
import { askData } from "@/lib/ai/ask-data";
import { runDataTool, type DataToolName } from "@/lib/ai/data-tools";
import { loadLedger, todayPR } from "@/lib/rent/service";

// AI drafting for landlords (Plan 39). Every action returns a draft for the
// landlord to review: nothing is saved or sent from here. Errors come back
// as codes the UI translates (ai.json → errors.*).

type Fail = { ok: false; code: AiErrorCode; error: string };

const MESSAGES: Record<AiErrorCode, string> = {
  disabled: "La asistencia con IA no está disponible.",
  expired: "Sesión expirada. Inicia sesión de nuevo.",
  invalid: "Revisa los datos e intenta de nuevo.",
  not_found: "Contrato no encontrado.",
  not_signed: "Solo los contratos firmados admiten avisos.",
  missing_amount: "Indica el balance pendiente.",
  rate_limited: "Demasiadas solicitudes. Espera un momento.",
  quota: "Llegaste al límite mensual de tu plan.",
  busy: "El servicio está ocupado. Intenta en un minuto.",
  refused: "No se pudo generar un borrador para este texto.",
  empty: "No se obtuvo respuesta. Intenta de nuevo.",
  too_many_steps: "La pregunta necesitó demasiados pasos. Hazla más específica.",
  failed: "No se pudo completar. Intenta de nuevo.",
};
const fail = (code: AiErrorCode): Fail => ({ ok: false, code, error: MESSAGES[code] });

/** Session, rate limit and monthly quota shared by every AI action. */
async function gate(feature: AiFeature) {
  if (!aiEnabled()) return { ok: false, fail: fail("disabled") } as const;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, fail: fail("expired") } as const;
  if (await rateLimitStrict(`ai:${user.id}`)) return { ok: false, fail: fail("rate_limited") } as const;
  // Metering table is written by the service role only.
  const admin = createAdminClient();
  const plan = await getPlan(supabase, user.id);
  if ((await aiQuotaRemaining(admin, user.id, plan, feature)) <= 0) return { ok: false, fail: fail("quota") } as const;
  return { ok: true, supabase, user, admin } as const;
}

const uiLocale = async (): Promise<"es" | "en"> => ((await getLocale()) === "en" ? "en" : "es");

export type TranslateResult = { ok: true; title: string; translation: string; notes: string[] } | Fail;

export async function translateClauseAction(input: unknown): Promise<TranslateResult> {
  const parsed = AiTranslateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const g = await gate("translate");
  if (!g.ok) return g.fail;
  try {
    const { draft, usage } = await translateClause({ ...parsed.data, uiLocale: await uiLocale() });
    await recordAiUsage(g.admin, g.user.id, "translate", usage);
    return { ok: true, ...draft };
  } catch (e) {
    return fail(aiErrorCode(e, "translate"));
  }
}

export type NoticeResult = { ok: true; subject: string; body: string; locale: "es" | "en"; fromLedger: boolean } | Fail;

export async function draftNoticeAction(input: unknown): Promise<NoticeResult> {
  const parsed = AiNoticeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const g = await gate("notice");
  if (!g.ok) return g.fail;
  const { supabase, user, admin } = g;
  const p = parsed.data;

  // RLS client plus an explicit owner check: only the landlord's own lease.
  const [{ data: contract }, { data: profile }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, status, rent_amount, lease_end, unit_number, tenant:tenants(full_name, preferred_locale), property:properties(name)")
      .eq("id", p.contract_id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, company_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!contract) return fail("not_found");
  if (contract.status !== "signed") return fail("not_signed");

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  const tenant = one(contract.tenant as { full_name: string | null; preferred_locale?: string | null } | null);
  const propertyName = one(contract.property as { name: string | null } | null)?.name ?? "";
  const today = todayPR();
  const base = {
    today,
    tenant_name: tenant?.full_name ?? "",
    landlord_name: profile?.company_name || profile?.full_name || "",
    property: [propertyName, contract.unit_number ? `#${contract.unit_number}` : null].filter(Boolean).join(" "),
  };

  let facts: NoticeFacts;
  let fromLedger = false;
  if (p.kind === "late_payment") {
    const ledger = await loadLedger(supabase, p.contract_id, today);
    fromLedger = !!ledger.ledger;
    const amount = fromLedger ? ledger.summary.overdue : (p.amount_overdue ?? 0);
    if (!(amount > 0)) return fail("missing_amount");
    facts = {
      kind: "late_payment",
      ...base,
      monthly_rent: Number(contract.rent_amount) || 0,
      amount_overdue: amount,
      oldest_unpaid_due_date: fromLedger
        ? oldestUnpaidDue(
            ledger.charges.map((c) => ({ due_date: c.due_date, amount: Number(c.amount), voided: !!c.voided_at })),
            ledger.summary.paid,
            today
          )
        : null,
      source: fromLedger ? "rent_ledger" : "entered_by_landlord",
    };
  } else {
    facts = {
      kind: "renewal_offer",
      ...base,
      lease_end: contract.lease_end,
      current_rent: Number(contract.rent_amount) || 0,
      proposed_rent: p.proposed_rent ?? null,
      proposed_term_months: p.proposed_term_months ?? null,
    };
  }

  const locale = noticeLocale(tenant?.preferred_locale);
  try {
    const { draft, usage } = await draftNotice(facts, locale);
    await recordAiUsage(admin, user.id, "notice", usage);
    return { ok: true, ...draft, locale, fromLedger };
  } catch (e) {
    return fail(aiErrorCode(e, "notice"));
  }
}

export type AskDataResult = { ok: true; answer: string; tools: DataToolName[] } | Fail;

export async function askDataAction(input: unknown): Promise<AskDataResult> {
  const parsed = AiAskDataSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const g = await gate("qa");
  if (!g.ok) return g.fail;
  const { supabase, user, admin } = g;
  const today = todayPR();
  try {
    const out = await askData({
      question: parsed.data.question,
      locale: await uiLocale(),
      today,
      // The landlord's own RLS client: tools can only read what they can.
      runTool: (name, toolInput) => runDataTool({ supabase, userId: user.id, today }, name, toolInput),
    });
    await recordAiUsage(admin, user.id, "qa", out.usage);
    return { ok: true, answer: out.answer, tools: out.tools };
  } catch (e) {
    if (e instanceof AiError && e.usage) await recordAiUsage(admin, user.id, "qa", e.usage);
    return fail(aiErrorCode(e, "qa"));
  }
}
