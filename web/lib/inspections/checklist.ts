// Move-in / move-out checklist (Plan 36). Keys live in code; labels in
// messages/<locale>/inspections.json. Pure; unit-tested.
import type { InspectionCondition } from "@/lib/db";

export const CONDITIONS: readonly InspectionCondition[] = ["good", "fair", "poor", "damaged", "na"];

export const ROOM_ITEMS = {
  living: ["walls", "floors", "doors", "windows", "lighting", "outlets", "ceiling_fan"],
  kitchen: ["walls", "floors", "cabinets", "countertops", "stove", "fridge", "sink", "plumbing", "lighting"],
  bathroom: ["walls", "floors", "doors", "toilet", "basin", "shower", "plumbing", "lighting"],
  bedroom: ["walls", "floors", "doors", "windows", "closet", "lighting", "outlets"],
  general: ["keys", "locks", "smoke_detector", "water_heater", "ac", "electrical_panel"],
} as const;

export type RoomType = keyof typeof ROOM_ITEMS;
export const ROOM_TYPES = Object.keys(ROOM_ITEMS) as RoomType[];

export type SeedItem = { room: string; item: string; sort: number };

/** Default checklist: living room, kitchen, N bathrooms, N bedrooms, then general items. */
export function defaultChecklist(opts: { bedrooms?: number | null; bathrooms?: number | null } = {}): SeedItem[] {
  const clamp = (n: number | null | undefined, def: number, max: number) =>
    Math.min(max, Math.max(1, Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : def));
  const bedrooms = clamp(opts.bedrooms, 2, 6);
  const bathrooms = clamp(opts.bathrooms, 1, 4);
  const rooms: string[] = [
    "living",
    "kitchen",
    ...Array.from({ length: bathrooms }, (_, i) => `bathroom_${i + 1}`),
    ...Array.from({ length: bedrooms }, (_, i) => `bedroom_${i + 1}`),
    "general",
  ];
  const out: SeedItem[] = [];
  for (const room of rooms) {
    for (const item of ROOM_ITEMS[roomType(room) ?? "general"]) out.push({ room, item, sort: out.length });
  }
  return out;
}

/** "bedroom_2" → { type: "bedroom", n: 2 }. Unknown rooms return null type. */
export function parseRoom(room: string): { type: RoomType | null; n: number | null } {
  const m = /^([a-z]+)(?:_(\d+))?$/.exec(room);
  const type = m && (ROOM_TYPES as string[]).includes(m[1]) ? (m[1] as RoomType) : null;
  return { type, n: m?.[2] ? Number(m[2]) : null };
}

export function roomType(room: string): RoomType | null {
  return parseRoom(room).type;
}

/** Rooms in checklist order with their items. */
export function groupByRoom<T extends { room: string; sort: number }>(items: T[]): { room: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.sort - b.sort)) {
    const list = groups.get(it.room) ?? [];
    list.push(it);
    groups.set(it.room, list);
  }
  return [...groups].map(([room, list]) => ({ room, items: list }));
}

const RANK: Record<InspectionCondition, number | null> = { good: 0, fair: 1, poor: 2, damaged: 3, na: null };

/** True when the move-out condition is worse than at move-in. */
export function worsened(moveIn: InspectionCondition | null | undefined, moveOut: InspectionCondition | null | undefined): boolean {
  const a = moveIn ? RANK[moveIn] : null;
  const b = moveOut ? RANK[moveOut] : null;
  return a !== null && b !== null && b > a;
}

/** Move-in condition per room/item, for showing next to the move-out. */
export function baselineMap(items: { room: string; item: string; condition: InspectionCondition | null; note?: string | null }[]) {
  return new Map(items.map((i) => [`${i.room}/${i.item}`, { condition: i.condition, note: i.note ?? null }]));
}

export function progress(items: { condition: InspectionCondition | null }[]): { rated: number; total: number } {
  return { rated: items.filter((i) => i.condition).length, total: items.length };
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Labels for stored room/item keys. "bathroom_1" reads "Baño" when the
 * checklist has one bathroom and "Baño 1" when it has several. Unknown keys
 * (custom rooms or items) are shown as typed.
 */
export function inspectionLabeler(rooms: string[], t: Translate, hasKey: (key: string) => boolean) {
  const counts = new Map<string, number>();
  for (const r of new Set(rooms)) {
    const type = roomType(r);
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return {
    room(room: string): string {
      const { type, n } = parseRoom(room);
      if (!type) return room;
      return n && (counts.get(type) ?? 0) > 1 ? t(`rooms.${type}N`, { n }) : t(`rooms.${type}`);
    },
    item(item: string): string {
      return hasKey(`items.${item}`) ? t(`items.${item}`) : item;
    },
  };
}
