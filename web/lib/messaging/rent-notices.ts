// Which rent notices a lease's tenant should get today, and on which channel.
// Pure: the daily job (/api/cron/messages) and tests share it.
import { addDays, daysBetween, rentCoverage, summarize, type Charge, type Payment } from "@/lib/rent/schedule";
import type { MessageChannel } from "@/lib/db";

/** Reminder goes out up to this many days before the due date (once). */
export const REMIND_DAYS_BEFORE = 3;
/** Overdue notice goes out the day after grace ends; later days retry a failed send. */
export const OVERDUE_RETRY_DAYS = 3;

export type RentNotice = { kind: "reminder" | "overdue"; period: string; dueDate: string; amount: number };

/**
 * - reminder: rent comes due within REMIND_DAYS_BEFORE days and is not covered yet;
 * - overdue: grace has ended and the month's rent is still not covered.
 * Amounts are what the tenant owes: for a reminder, everything due through
 * that date; for an overdue notice, the past-due balance today (late fees included).
 * Idempotency keys make each one go out once.
 */
export function rentNotices(charges: Charge[], payments: Payment[], today: string, graceDays: number): RentNotice[] {
  const coverage = rentCoverage(charges, payments);
  const out: RentNotice[] = [];
  for (const c of charges) {
    if (c.kind !== "rent" || c.voided || !c.period || coverage.get(c.period)) continue;
    const until = daysBetween(today, c.due_date);
    if (until >= 1 && until <= REMIND_DAYS_BEFORE) {
      const amount = summarize(charges, payments, addDays(c.due_date, 1)).overdue;
      if (amount > 0) out.push({ kind: "reminder", period: c.period, dueDate: c.due_date, amount });
    }
    const lateFor = daysBetween(addDays(c.due_date, Math.max(graceDays, 0)), today);
    if (lateFor >= 1 && lateFor <= OVERDUE_RETRY_DAYS) {
      const amount = summarize(charges, payments, today).overdue;
      if (amount > 0) out.push({ kind: "overdue", period: c.period, dueDate: c.due_date, amount });
    }
  }
  return out;
}

export type ConsentState = { channel: MessageChannel; status: "opted_in" | "opted_out"; address: string };

/**
 * Best channel for a tenant: WhatsApp if they opted in (and a template is
 * configured), else SMS if they opted in and the landlord's plan includes
 * SMS, else email. Returns null when there is no way to reach them.
 */
export function pickTenantChannel(opts: {
  consents: ConsentState[];
  email: string | null | undefined;
  smsAllowed: boolean;
  whatsappReady: boolean;
}): { channel: MessageChannel; to: string } | null {
  const optedIn = (ch: MessageChannel) => opts.consents.find((c) => c.channel === ch && c.status === "opted_in");
  const wa = optedIn("whatsapp");
  if (wa && opts.whatsappReady) return { channel: "whatsapp", to: wa.address };
  const sms = optedIn("sms");
  if (sms && opts.smsAllowed) return { channel: "sms", to: sms.address };
  if (opts.email) return { channel: "email", to: opts.email };
  return null;
}

export const rentKey = (contractId: string, period: string, kind: RentNotice["kind"]) => `rent:${contractId}:${period}:${kind}`;
export const digestKey = (ownerId: string, date: string) => `digest:${ownerId}:${date}`;
