// Onboarding emails after signup. Each step has a send window (days since
// signup) and is skipped once the landlord has already done what it suggests,
// so nobody is told to add a property they already added.

export type LifecycleStep = "welcome" | "first_property" | "first_contract" | "esign";

export type LifecycleProgress = {
  properties: number;
  contracts: number;
  /** Contracts that went out for signature (sent or signed). */
  sentForSignature: number;
};

const STEPS: { step: LifecycleStep; from: number; to: number; done: (p: LifecycleProgress) => boolean }[] = [
  { step: "welcome", from: 0, to: 1, done: () => false },
  { step: "first_property", from: 1, to: 3, done: (p) => p.properties > 0 },
  { step: "first_contract", from: 3, to: 6, done: (p) => p.contracts > 0 },
  { step: "esign", from: 7, to: 10, done: (p) => p.sentForSignature > 0 },
];

/** Users older than this are never emailed (covers existing accounts at launch). */
export const LIFECYCLE_MAX_AGE_DAYS = 10;

export function daysSince(createdAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000);
}

/** The single step to send today, or null. At most one email per user per run. */
export function nextLifecycleStep(ageDays: number, progress: LifecycleProgress, sent: ReadonlySet<string>): LifecycleStep | null {
  for (const s of STEPS) {
    if (sent.has(s.step) || ageDays < s.from || ageDays > s.to || s.done(progress)) continue;
    return s.step;
  }
  return null;
}
