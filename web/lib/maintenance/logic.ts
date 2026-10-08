// Pure rules for maintenance requests (Plan 36). No I/O; unit-tested.
import type { MaintenanceCategory, MaintenanceStatus, MaintenanceUrgency } from "@/lib/db";
import { daysBetween } from "@/lib/reminders";

export const CATEGORIES: readonly MaintenanceCategory[] = ["plumbing", "electrical", "appliance", "ac", "pest", "structural", "other"];
export const URGENCIES: readonly MaintenanceUrgency[] = ["low", "normal", "urgent", "emergency"];
export const STATUSES: readonly MaintenanceStatus[] = ["open", "scheduled", "in_progress", "resolved", "cancelled"];

/** Statuses a request can move to from each status. Closed ones can be reopened. */
const TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  open: ["scheduled", "in_progress", "resolved", "cancelled"],
  scheduled: ["open", "in_progress", "resolved", "cancelled"],
  in_progress: ["scheduled", "resolved", "cancelled"],
  resolved: ["open"],
  cancelled: ["open"],
};

export function nextStatuses(from: MaintenanceStatus): readonly MaintenanceStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** The tenant hears about these status changes by email. */
export function notifiesTenant(to: MaintenanceStatus): boolean {
  return to === "scheduled" || to === "resolved";
}

export function isOpen(status: MaintenanceStatus): boolean {
  return status === "open" || status === "scheduled" || status === "in_progress";
}

/** Open urgent and emergency requests go to the dashboard queue and the bell. */
export function needsAttention(r: { status: MaintenanceStatus; urgency: MaintenanceUrgency }): boolean {
  return isOpen(r.status) && (r.urgency === "urgent" || r.urgency === "emergency");
}

const URGENCY_RANK: Record<MaintenanceUrgency, number> = { emergency: 0, urgent: 1, normal: 2, low: 3 };

/** Open before closed, then most urgent, then oldest first. */
export function compareRequests(
  a: { status: MaintenanceStatus; urgency: MaintenanceUrgency; created_at: string },
  b: { status: MaintenanceStatus; urgency: MaintenanceUrgency; created_at: string }
): number {
  return (
    Number(!isOpen(a.status)) - Number(!isOpen(b.status)) ||
    URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
    a.created_at.localeCompare(b.created_at)
  );
}

// ── Photos ──────────────────────────────────────────────────────────────────

export const PHOTO_BUCKET = "maintenance-photos";
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_RECORD = 12;
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
export const PHOTO_ACCEPT = Object.keys(PHOTO_TYPES).join(",");

export type PhotoScope = "maintenance" | "inspections";

/** Returns the file extension for an allowed photo, or an error code. */
export function checkPhoto(type: string, size: number): { ok: true; ext: string } | { ok: false; error: "type" | "size" } {
  const ext = PHOTO_TYPES[type.toLowerCase()];
  if (!ext) return { ok: false, error: "type" };
  if (!(size > 0) || size > MAX_PHOTO_BYTES) return { ok: false, error: "size" };
  return { ok: true, ext };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Storage path: <owner>/<scope>/<record>/<file uuid>.<ext>. The owner folder keeps each landlord's files together. */
export function photoPath(ownerId: string, scope: PhotoScope, recordId: string, fileId: string, ext: string): string {
  return `${ownerId}/${scope}/${recordId}/${fileId}.${ext}`;
}

/** True when `path` is a photo path this server handed out for that record. */
export function isPhotoPathFor(path: string, ownerId: string, scope: PhotoScope, recordId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  const [owner, s, record, file] = parts;
  const m = /^([0-9a-f-]{36})\.(jpg|png|webp|heic|heif)$/i.exec(file);
  return owner === ownerId && s === scope && record === recordId && UUID.test(record) && !!m && UUID.test(m[1]);
}

/** Whether a browser can show the photo inline (HEIC only renders in Safari). */
export function isRenderable(path: string): boolean {
  return /\.(jpg|png|webp)$/i.test(path);
}

// ── Renewal suggestions ─────────────────────────────────────────────────────

export const RENEWAL_WINDOW = { from: 60, to: 90 } as const;

/**
 * Signed leases ending 60–90 days from today that have no renewal yet
 * (a contract whose parent_contract_id points at them and is not cancelled).
 */
export function renewalCandidates<T extends { id: string; status: string; lease_end: string | null; parent_contract_id?: string | null }>(
  contracts: T[],
  today: string
): (T & { days: number })[] {
  const renewed = new Set(
    contracts.filter((c) => c.parent_contract_id && c.status !== "cancelled").map((c) => c.parent_contract_id as string)
  );
  return contracts
    .filter((c) => c.status === "signed" && c.lease_end && !renewed.has(c.id))
    .map((c) => ({ ...c, days: daysBetween(today, c.lease_end as string) }))
    .filter((c) => c.days >= RENEWAL_WINDOW.from && c.days <= RENEWAL_WINDOW.to)
    .sort((a, b) => a.days - b.days);
}
