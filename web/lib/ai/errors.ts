import Anthropic from "@anthropic-ai/sdk";

// Error codes the AI server actions return. The UI maps each one to a
// translated message (ai.json → errors.<code>).
export type AiErrorCode =
  | "disabled"
  | "expired"
  | "invalid"
  | "not_found"
  | "not_signed"
  | "missing_amount"
  | "rate_limited"
  | "quota"
  | "busy"
  | "refused"
  | "empty"
  | "too_many_steps"
  | "failed";

/** A failure the feature code raises on purpose (refusal, empty output, …). */
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    /** Tokens already spent when the failure happened, so they are still metered. */
    public usage?: { model: string; input_tokens: number; output_tokens: number }
  ) {
    super(code);
  }
}

/**
 * Maps any error from an AI call to a code. Logs the status only, never the
 * prompt, the clause text or the model's output.
 */
export function aiErrorCode(e: unknown, feature: string): AiErrorCode {
  if (e instanceof AiError) return e.code;
  if (e instanceof Anthropic.RateLimitError) return "busy";
  if (e instanceof Anthropic.APIError) {
    // 529 overloaded behaves like a rate limit for the user.
    if (e.status === 529) return "busy";
    console.error(JSON.stringify({ level: "error", msg: "ai call failed", feature, status: e.status ?? null }));
    return "failed";
  }
  console.error(JSON.stringify({ level: "error", msg: "ai feature error", feature, err: e instanceof Error ? e.name : typeof e }));
  return "failed";
}
