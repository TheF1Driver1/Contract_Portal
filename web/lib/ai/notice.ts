import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_MODEL, FALLBACK_BETA, anthropic } from "./client";
import { AiError } from "./errors";

// Short notice drafts for a signed lease. Built from structured facts only
// (the tenant's name is the only tenant data sent). The landlord edits and
// sends it themselves: nothing here sends anything.

export const NOTICE_KINDS = ["late_payment", "renewal_offer"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export type NoticeFacts =
  | {
      kind: "late_payment";
      today: string;
      tenant_name: string;
      landlord_name: string;
      property: string;
      monthly_rent: number;
      amount_overdue: number;
      oldest_unpaid_due_date: string | null;
      source: "rent_ledger" | "entered_by_landlord";
    }
  | {
      kind: "renewal_offer";
      today: string;
      tenant_name: string;
      landlord_name: string;
      property: string;
      lease_end: string;
      current_rent: number;
      proposed_rent: number | null;
      proposed_term_months: number | null;
    };

export const NoticeDraft = z.object({ subject: z.string(), body: z.string() });
export type NoticeDraft = z.infer<typeof NoticeDraft>;

export const NOTICE_SYSTEM = {
  es: `Redactas avisos breves de un arrendador a su inquilino en Puerto Rico. El arrendador revisará y editará el borrador antes de enviarlo.
- Escribe en español de Puerto Rico, cordial y profesional, tratando al inquilino de "usted".
- Usa solo los datos del JSON. No inventes montos, fechas, plazos, cargos, leyes ni consecuencias. Si falta un dato necesario, deja un espacio entre corchetes, por ejemplo [fecha límite].
- No amenaces con desahucio ni acciones legales, no cites leyes y no des asesoría legal.
- Aviso de pago atrasado: indica el monto pendiente y la fecha de vencimiento más antigua si existe, e invita a pagar o a comunicarse para acordar un plan.
- Oferta de renovación: indica cuándo termina el contrato y la renta propuesta (si no hay propuesta, mantén la renta actual) y pide una respuesta.
- Máximo 160 palabras en el cuerpo. Texto plano, sin encabezados ni negritas. Firma con el nombre del arrendador.
- "subject" es un asunto corto; "body" es el aviso completo con saludo y firma.`,
  en: `You draft short notices from a landlord to their tenant in Puerto Rico. The landlord will review and edit the draft before sending it.
- Write in plain, courteous, professional U.S. English.
- Use only the data in the JSON. Do not invent amounts, dates, deadlines, fees, laws or consequences. If a needed detail is missing, leave a bracketed blank such as [deadline].
- Do not threaten eviction or legal action, do not cite laws and do not give legal advice.
- Late payment notice: state the amount past due and the oldest due date if present, and invite the tenant to pay or get in touch to agree on a plan.
- Renewal offer: state when the lease ends and the proposed rent (if none is proposed, keep the current rent) and ask for a reply.
- At most 160 words in the body. Plain text, no headings or bold. Sign with the landlord's name.
- "subject" is a short subject line; "body" is the full notice with greeting and signature.`,
} as const;

export async function draftNotice(facts: NoticeFacts, locale: "es" | "en") {
  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(NoticeDraft) },
    system: NOTICE_SYSTEM[locale],
    messages: [{ role: "user", content: [{ type: "text", text: `Datos / Data:\n${JSON.stringify(facts, null, 2)}` }] }],
  });
  if (response.stop_reason === "refusal") throw new AiError("refused");
  const out = response.parsed_output;
  if (!out || !out.body.trim()) throw new AiError("empty");
  return {
    draft: { subject: out.subject.trim().slice(0, 200), body: out.body.trim().slice(0, 5000) },
    usage: { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

/** Tenant language for the notice: their preferred locale, Spanish by default. */
export function noticeLocale(preferred: string | null | undefined): "es" | "en" {
  return preferred === "en" ? "en" : "es";
}

/** The oldest unpaid rent due date, applying payments to the oldest charges first. */
export function oldestUnpaidDue(
  charges: { due_date: string; amount: number; voided?: boolean }[],
  paid: number,
  today: string
): string | null {
  let left = paid;
  for (const c of charges.filter((x) => !x.voided && x.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    if (left >= c.amount) {
      left -= c.amount;
      continue;
    }
    return c.due_date;
  }
  return null;
}
