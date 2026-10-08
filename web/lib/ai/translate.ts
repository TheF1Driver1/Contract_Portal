import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_MODEL, FALLBACK_BETA, anthropic } from "./client";
import { AiError } from "./errors";
import { glossaryPrompt } from "./glossary";

// Draft ES↔EN translation of one custom lease clause. The landlord reviews
// and accepts or discards it; nothing is saved here.

export type TranslateTarget = "en" | "es";

export const ClauseTranslation = z.object({
  title: z.string(),
  translation: z.string(),
  notes: z.array(z.string()),
});
export type ClauseTranslation = z.infer<typeof ClauseTranslation>;

// One system block for both directions so the glossary prefix stays cacheable.
export const TRANSLATE_SYSTEM = `You translate custom clauses of residential lease agreements in Puerto Rico between Spanish and English for the landlord, who will review your draft before using it.

Rules:
- Translate faithfully. Do not add, remove, soften or strengthen obligations, amounts, dates, deadlines or conditions.
- Keep numbers, money amounts, dates, names, addresses and placeholders such as {name} or [fecha] exactly as written.
- Use the glossary below for these terms every time. Puerto Rico leases are governed by the Puerto Rico Civil Code of 2020 (Act 55-2020); never replace it with U.S. state law or common-law concepts.
- Spanish output: Puerto Rico usage, formal contract register.
- English output: plain U.S. English, formal contract register.
- Keep paragraph breaks and list structure.
- "title" is the translated clause title. "translation" is the translated clause body (empty if the body is empty).
- "notes": short notes, in the landlord's language given in the request, only for real issues: a term with no exact equivalent, an ambiguity in the original, or a possible legal concern the landlord should ask an attorney about. Never give legal advice. Empty list if none.

Glossary (Spanish = English):
${glossaryPrompt()}`;

const LANG = { es: "Spanish", en: "English" } as const;

export async function translateClause(opts: { title: string; body: string; target: TranslateTarget; uiLocale: "es" | "en" }) {
  const source: TranslateTarget = opts.target === "en" ? "es" : "en";
  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ClauseTranslation) },
    // Same instructions and glossary on every call: cache them.
    system: [{ type: "text", text: TRANSLATE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Translate this clause from ${LANG[source]} to ${LANG[opts.target]}. Write the notes in ${LANG[opts.uiLocale]}.\n\n<title>\n${opts.title}\n</title>\n<body>\n${opts.body}\n</body>`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new AiError("refused");
  const out = response.parsed_output;
  if (!out || !out.title.trim()) throw new AiError("empty");
  return {
    draft: {
      title: out.title.trim().slice(0, 200),
      translation: out.translation.trim().slice(0, 10_000),
      notes: out.notes.map((n) => n.trim()).filter(Boolean).slice(0, 5),
    },
    usage: { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
