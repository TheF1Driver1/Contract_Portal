import { AI_MODEL, FALLBACK_BETA, anthropic } from "./client";

// Tenant-facing help while reviewing a lease. Answers come only from the
// lease itself and are labeled as not legal advice in the UI.
export function leaseHelpEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.AI_LEASE_HELP === "1";
}

const SYSTEM = {
  es: `Ayudas a un inquilino en Puerto Rico a entender el contrato de arrendamiento adjunto antes de firmarlo.
- Contesta solo con lo que dice el contrato. Si el contrato no lo dice, dilo claramente ("El contrato no menciona…").
- Usa español sencillo de Puerto Rico, tuteando, en frases cortas. Cita el número de la cláusula cuando aplique.
- No des asesoría legal, no opines si una cláusula es válida o conveniente, y no inventes leyes. Si la pregunta requiere un abogado, sugiere consultar uno.
- Responde en texto plano. Para listas usa líneas que empiecen con "- ". Sin encabezados ni negritas.
- Máximo 180 palabras.`,
  en: `You help a tenant in Puerto Rico understand the attached lease before signing it.
- Answer only from what the lease says. If the lease does not say, say so clearly ("The lease doesn't mention…").
- Use plain, short sentences. Cite the clause number when relevant.
- Do not give legal advice, do not judge whether a clause is valid or fair, and do not invent laws. If the question needs a lawyer, suggest consulting one.
- Reply in plain text. For lists, use lines starting with "- ". No headings or bold.
- 180 words maximum.`,
} as const;

const SUMMARY = {
  es: "Resume este contrato en lenguaje sencillo: duración, renta y cuándo se paga, cargos por atraso, depósito, quién paga utilidades y reparaciones, mascotas, y cómo se termina o renueva.",
  en: "Summarize this lease in plain language: term, rent and when it is due, late fees, deposit, who pays utilities and repairs, pets, and how it ends or renews.",
} as const;

export class LeaseHelpError extends Error {
  constructor(public code: "refused" | "empty") {
    super(code);
  }
}

export async function askLease(opts: { pdf: Buffer; lang: "es" | "en"; question: string | null }) {
  const response = await anthropic().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM[opts.lang],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: opts.pdf.toString("base64") },
            // Same lease, several questions: reuse the cached document.
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: opts.question?.trim() || SUMMARY[opts.lang] },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new LeaseHelpError("refused");
  const answer = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  if (!answer) throw new LeaseHelpError("empty");
  return {
    answer,
    usage: { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
