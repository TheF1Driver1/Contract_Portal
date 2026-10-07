export interface ReminderTrigger {
  id: string;
  days_before: number;
}

/**
 * Picks which of an owner's triggers is due for a contract with `daysLeft`
 * days remaining. A trigger is due once daysLeft <= days_before, so a missed
 * cron day catches up instead of skipping the reminder.
 *
 * Only the closest due trigger is sent; larger due triggers that were never
 * sent are returned as `skip` so they are logged and never sent late
 * (e.g. a contract created 10 days before its end gets one reminder, not three).
 */
export function pickReminder(
  triggers: ReminderTrigger[],
  daysLeft: number,
  handledTriggerIds: Set<string>
): { send: ReminderTrigger | null; skip: ReminderTrigger[] } {
  if (daysLeft < 0) return { send: null, skip: [] };
  const due = triggers
    .filter((t) => daysLeft <= t.days_before && !handledTriggerIds.has(t.id))
    .sort((a, b) => a.days_before - b.days_before);
  if (due.length === 0) return { send: null, skip: [] };
  const [send, ...skip] = due;
  return { send, skip };
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
