// Pure helpers for inbound/outbound messaging: phone numbers, opt-out
// keywords and provider status mapping. Shared by webhooks, cron and tests.
import type { MessageStatus } from "@/lib/db";

/** E.164 for a US/PR number written any common way; null when it can't tell. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^whatsapp:/i, "");
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type Keyword = "stop" | "start" | "help";

const STOP = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "PARAR", "BAJA"];
const START = ["START", "UNSTOP", "ALTA"];
const HELP = ["HELP", "AYUDA", "INFO"];

/**
 * Carrier-style keyword matching: the whole message must be the keyword
 * (case, accents and surrounding punctuation ignored), so "no puedo parar
 * de reír" is a normal message, not an opt-out.
 */
export function parseKeyword(body: string | null | undefined): Keyword | null {
  if (!body) return null;
  const word = body
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
    .toUpperCase();
  if (STOP.includes(word)) return "stop";
  if (START.includes(word)) return "start";
  if (HELP.includes(word)) return "help";
  return null;
}

/** Twilio MessageStatus → ours. Unknown values return null (ignored). */
export function fromTwilioStatus(s: string | null | undefined): MessageStatus | null {
  switch ((s ?? "").toLowerCase()) {
    case "accepted":
    case "scheduled":
    case "queued":
    case "sending":
      return "queued";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
    case "undelivered":
    case "canceled":
      return "failed";
    default:
      return null;
  }
}

/** Resend webhook event type → ours. */
export function fromResendEvent(type: string | null | undefined): MessageStatus | null {
  switch (type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
    case "email.clicked":
      return "read";
    case "email.bounced":
    case "email.complained":
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

const RANK: Record<MessageStatus, number> = { skipped: 0, queued: 1, sent: 2, failed: 3, delivered: 4, read: 5, received: 0 };

/**
 * Status callbacks arrive out of order; only move forward. A failure can
 * replace queued/sent but not a confirmed delivery or read.
 */
export function advanceStatus(current: MessageStatus, incoming: MessageStatus): MessageStatus | null {
  if (current === incoming || current === "skipped" || current === "received") return null;
  return RANK[incoming] > RANK[current] ? incoming : null;
}
