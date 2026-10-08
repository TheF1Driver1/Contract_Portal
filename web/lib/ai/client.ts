import Anthropic from "@anthropic-ai/sdk";

// Server-only access to Claude. Every AI feature is off unless the key is set.
export const AI_MODEL = "claude-opus-5-5";

/** Beta flag for server-side refusal fallbacks (`fallbacks: "default"`). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}
