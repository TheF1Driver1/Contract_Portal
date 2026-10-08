import type { BetaContentBlockParam, BetaMessageParam, BetaToolResultBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AI_MODEL, FALLBACK_BETA, anthropic } from "./client";
import { AiError } from "./errors";
import { dataToolDefinitions, type DataToolName } from "./data-tools";

// "Pregúntale a tus datos": answers a landlord's question by calling the
// read-only data tools. A manual loop (rather than the SDK tool runner) so
// each step's stop_reason is checked and the number of calls is capped.

export const MAX_TOOL_ITERATIONS = 5;

export function askDataSystem(locale: "es" | "en", today: string): string {
  return locale === "es"
    ? `Contestas preguntas de un arrendador en Puerto Rico sobre sus propios datos (contratos, renta, mantenimiento) en ContractOS.
- Hoy es ${today} (hora de Puerto Rico). Montos en dólares (USD).
- Usa las herramientas para obtener los datos; nunca inventes nombres, montos ni fechas. Si las herramientas no cubren la pregunta, dilo y sugiere dónde mirar en la app.
- Los datos de pagos solo incluyen contratos con cuenta de renta activa; menciónalo si hay contratos sin ella.
- No des asesoría legal ni contributiva.
- Responde en español de Puerto Rico, tuteando, en texto plano. Para listas usa líneas que empiecen con "- ". Máximo 150 palabras.`
    : `You answer a Puerto Rico landlord's questions about their own data (leases, rent, maintenance) in ContractOS.
- Today is ${today} (Puerto Rico time). Amounts are in U.S. dollars.
- Use the tools to get the data; never invent names, amounts or dates. If the tools do not cover the question, say so and suggest where to look in the app.
- Payment data only covers leases with rent tracking turned on; mention it when some leases lack it.
- Do not give legal or tax advice.
- Reply in plain English text. For lists, use lines starting with "- ". 150 words maximum.`;
}

type RunTool = (name: string, input: unknown) => Promise<unknown>;

export async function askData(opts: { question: string; locale: "es" | "en"; today: string; runTool: RunTool }) {
  const tools = dataToolDefinitions();
  const messages: BetaMessageParam[] = [{ role: "user", content: opts.question.trim() }];
  const used = new Set<DataToolName>();
  const usage = { model: AI_MODEL as string, input_tokens: 0, output_tokens: 0 };

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: askDataSystem(opts.locale, opts.today),
      tools,
      // Forced tool_choice is not supported by this model; let it decide.
      tool_choice: { type: "auto" },
      messages,
    });
    usage.model = response.model;
    usage.input_tokens += response.usage.input_tokens ?? 0;
    usage.output_tokens += response.usage.output_tokens ?? 0;

    if (response.stop_reason === "refusal") throw new AiError("refused");

    if (response.stop_reason === "tool_use") {
      const calls = response.content.flatMap((b) => (b.type === "tool_use" ? [b] : []));
      // Send the assistant turn back unchanged (thinking blocks included).
      messages.push({ role: "assistant", content: response.content as BetaContentBlockParam[] });
      const results: BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        try {
          const out = await opts.runTool(call.name, call.input);
          used.add(call.name as DataToolName);
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out) });
        } catch {
          // No details: the model only needs to know the lookup failed.
          results.push({ type: "tool_result", tool_use_id: call.id, content: "The lookup failed.", is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    const answer = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    if (!answer) throw new AiError("empty");
    return { answer, tools: [...used], usage };
  }
  throw new AiError("too_many_steps", usage);
}
