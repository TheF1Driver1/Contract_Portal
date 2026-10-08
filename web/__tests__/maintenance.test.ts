import { describe, expect, it } from "vitest";
import {
  canTransition,
  checkPhoto,
  compareRequests,
  isPhotoPathFor,
  isRenderable,
  MAX_PHOTO_BYTES,
  needsAttention,
  nextStatuses,
  notifiesTenant,
  photoPath,
  renewalCandidates,
} from "@/lib/maintenance/logic";
import { baselineMap, defaultChecklist, groupByRoom, inspectionLabeler, parseRoom, progress, worsened } from "@/lib/inspections/checklist";
import { MaintenanceCreateSchema, MaintenanceUpdateSchema, InspectionAckSchema } from "@/lib/schemas";

const OWNER = "11111111-1111-4111-8111-111111111111";
const REQ = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";

describe("maintenance status rules", () => {
  it("allows the normal flow and reopening", () => {
    expect(canTransition("open", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "resolved")).toBe(true);
    expect(canTransition("resolved", "open")).toBe(true);
    expect(canTransition("cancelled", "open")).toBe(true);
  });
  it("blocks jumps out of closed states", () => {
    expect(canTransition("resolved", "scheduled")).toBe(false);
    expect(canTransition("cancelled", "resolved")).toBe(false);
    expect(nextStatuses("resolved")).toEqual(["open"]);
  });
  it("emails the tenant only when scheduled or resolved", () => {
    expect(notifiesTenant("scheduled")).toBe(true);
    expect(notifiesTenant("resolved")).toBe(true);
    expect(notifiesTenant("in_progress")).toBe(false);
    expect(notifiesTenant("cancelled")).toBe(false);
  });
  it("flags open urgent and emergency requests only", () => {
    expect(needsAttention({ status: "open", urgency: "emergency" })).toBe(true);
    expect(needsAttention({ status: "in_progress", urgency: "urgent" })).toBe(true);
    expect(needsAttention({ status: "resolved", urgency: "emergency" })).toBe(false);
    expect(needsAttention({ status: "open", urgency: "normal" })).toBe(false);
  });
  it("sorts open before closed, then by urgency, then oldest", () => {
    const rows = [
      { id: "a", status: "resolved" as const, urgency: "emergency" as const, created_at: "2026-01-01" },
      { id: "b", status: "open" as const, urgency: "normal" as const, created_at: "2026-01-01" },
      { id: "c", status: "open" as const, urgency: "emergency" as const, created_at: "2026-02-01" },
      { id: "d", status: "scheduled" as const, urgency: "normal" as const, created_at: "2025-12-01" },
    ];
    expect([...rows].sort(compareRequests).map((r) => r.id)).toEqual(["c", "d", "b", "a"]);
  });
});

describe("photo rules", () => {
  it("accepts the allowed image types up to 8 MB", () => {
    expect(checkPhoto("image/jpeg", 1000)).toEqual({ ok: true, ext: "jpg" });
    expect(checkPhoto("image/HEIC", 1000)).toEqual({ ok: true, ext: "heic" });
    expect(checkPhoto("image/png", MAX_PHOTO_BYTES)).toEqual({ ok: true, ext: "png" });
  });
  it("rejects other types, empty and oversized files", () => {
    expect(checkPhoto("application/pdf", 1000)).toEqual({ ok: false, error: "type" });
    expect(checkPhoto("image/gif", 1000)).toEqual({ ok: false, error: "type" });
    expect(checkPhoto("image/jpeg", MAX_PHOTO_BYTES + 1)).toEqual({ ok: false, error: "size" });
    expect(checkPhoto("image/jpeg", 0)).toEqual({ ok: false, error: "size" });
  });
  it("only accepts paths it hands out for that owner and record", () => {
    const path = photoPath(OWNER, "maintenance", REQ, FILE, "jpg");
    expect(path).toBe(`${OWNER}/maintenance/${REQ}/${FILE}.jpg`);
    expect(isPhotoPathFor(path, OWNER, "maintenance", REQ)).toBe(true);
    expect(isPhotoPathFor(path, OWNER, "inspections", REQ)).toBe(false);
    expect(isPhotoPathFor(path, REQ, "maintenance", REQ)).toBe(false);
    expect(isPhotoPathFor(`${OWNER}/maintenance/${REQ}/../x/${FILE}.jpg`, OWNER, "maintenance", REQ)).toBe(false);
    expect(isPhotoPathFor(`${OWNER}/maintenance/${REQ}/${FILE}.exe`, OWNER, "maintenance", REQ)).toBe(false);
  });
  it("knows which files a browser can show inline", () => {
    expect(isRenderable("a/b/c/d.webp")).toBe(true);
    expect(isRenderable("a/b/c/d.heic")).toBe(false);
  });
});

describe("renewal suggestions", () => {
  const today = "2026-10-08";
  const lease = (id: string, lease_end: string, extra: Record<string, unknown> = {}) => ({ id, status: "signed", lease_end, parent_contract_id: null as string | null, ...extra });
  it("suggests signed leases ending in 60–90 days without a renewal", () => {
    const out = renewalCandidates(
      [
        lease("in75", "2026-12-22"),
        lease("in59", "2026-12-06"),
        lease("in60", "2026-12-07"),
        lease("in90", "2027-01-06"),
        lease("in91", "2027-01-07"),
        lease("draft", "2026-12-22", { status: "draft" }),
      ],
      today
    );
    expect(out.map((c) => [c.id, c.days])).toEqual([["in60", 60], ["in75", 75], ["in90", 90]]);
  });
  it("skips leases that already have a renewal draft, unless it was cancelled", () => {
    const out = renewalCandidates(
      [
        lease("a", "2026-12-22"),
        lease("b", "2026-12-22"),
        { id: "a2", status: "draft", lease_end: "2027-12-22", parent_contract_id: "a" },
        { id: "b2", status: "cancelled", lease_end: "2027-12-22", parent_contract_id: "b" },
      ],
      today
    );
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("inspection checklist", () => {
  it("seeds rooms from bedrooms and bathrooms, with stable sort", () => {
    const items = defaultChecklist({ bedrooms: 3, bathrooms: 2 });
    const rooms = groupByRoom(items).map((g) => g.room);
    expect(rooms).toEqual(["living", "kitchen", "bathroom_1", "bathroom_2", "bedroom_1", "bedroom_2", "bedroom_3", "general"]);
    expect(items.map((i) => i.sort)).toEqual(items.map((_, i) => i));
    expect(new Set(items.map((i) => `${i.room}/${i.item}`)).size).toBe(items.length);
  });
  it("falls back to 2 bedrooms and 1 bathroom, and clamps", () => {
    const rooms = (o: Parameters<typeof defaultChecklist>[0]) => new Set(defaultChecklist(o).map((i) => i.room));
    expect([...rooms({})].filter((r) => r.startsWith("bedroom"))).toHaveLength(2);
    expect([...rooms({ bathrooms: 0 })].filter((r) => r.startsWith("bathroom"))).toHaveLength(1);
    expect([...rooms({ bedrooms: 40 })].filter((r) => r.startsWith("bedroom"))).toHaveLength(6);
  });
  it("parses room keys", () => {
    expect(parseRoom("bedroom_2")).toEqual({ type: "bedroom", n: 2 });
    expect(parseRoom("kitchen")).toEqual({ type: "kitchen", n: null });
    expect(parseRoom("Terraza")).toEqual({ type: null, n: null });
  });
  it("labels numbered rooms only when there are several", () => {
    const t = (k: string, v?: Record<string, string | number>) => (v?.n ? `${k}:${v.n}` : k);
    const l = inspectionLabeler(["bathroom_1", "bedroom_1", "bedroom_2"], t, (k) => k !== "items.custom");
    expect(l.room("bathroom_1")).toBe("rooms.bathroom");
    expect(l.room("bedroom_2")).toBe("rooms.bedroomN:2");
    expect(l.room("Terraza")).toBe("Terraza");
    expect(l.item("walls")).toBe("items.walls");
    expect(l.item("custom")).toBe("custom");
  });
  it("compares move-out against move-in", () => {
    expect(worsened("good", "damaged")).toBe(true);
    expect(worsened("fair", "fair")).toBe(false);
    expect(worsened("poor", "good")).toBe(false);
    expect(worsened("good", "na")).toBe(false);
    expect(worsened(null, "damaged")).toBe(false);
    const base = baselineMap([{ room: "kitchen", item: "stove", condition: "good" }]);
    expect(base.get("kitchen/stove")?.condition).toBe("good");
  });
  it("counts rated items", () => {
    expect(progress([{ condition: "good" }, { condition: null }, { condition: "na" }])).toEqual({ rated: 2, total: 3 });
  });
});

describe("schemas", () => {
  it("validates a new request", () => {
    expect(MaintenanceCreateSchema.safeParse({ contract_id: REQ, title: " Gotera ", category: "plumbing", urgency: "urgent" }).success).toBe(true);
    expect(MaintenanceCreateSchema.safeParse({ contract_id: REQ, title: "", category: "plumbing", urgency: "urgent" }).success).toBe(false);
    expect(MaintenanceCreateSchema.safeParse({ contract_id: REQ, title: "x", category: "roof", urgency: "urgent" }).success).toBe(false);
  });
  it("rounds cost and accepts an empty date", () => {
    const r = MaintenanceUpdateSchema.parse({ id: REQ, cost: 10.005, scheduled_for: "" });
    expect(r.cost).toBe(10.01);
  });
  it("requires the acknowledgment checkbox and a name", () => {
    expect(InspectionAckSchema.safeParse({ id: REQ, name: "Ana Colón", confirm: true }).success).toBe(true);
    expect(InspectionAckSchema.safeParse({ id: REQ, name: "Ana Colón", confirm: false }).success).toBe(false);
    expect(InspectionAckSchema.safeParse({ id: REQ, name: "A", confirm: true }).success).toBe(false);
  });
});

describe("inspection PDF", () => {
  it("renders a move-out report with the move-in column", async () => {
    const { renderInspectionPdf } = await import("@/lib/inspections/pdf");
    const items = defaultChecklist({ bedrooms: 1, bathrooms: 1 }).map((i, n) => ({
      ...i,
      condition: n % 7 === 0 ? ("damaged" as const) : ("good" as const),
      note: n === 0 ? "Mancha en la pared" : null,
      baseline: "good" as const,
      photoCount: n === 0 ? 2 : 0,
      images: [],
    }));
    const pdf = await renderInspectionPdf({
      kind: "move_out",
      draft: false,
      inspectedOn: "2026-10-08",
      property: "Edificio Las Palmas 2B, San Juan",
      tenant: "José Martínez",
      landlord: "Rivera Propiedades",
      notes: "Se entregaron 2 llaves.",
      completedAt: "2026-10-08T15:00:00Z",
      ackAt: null,
      ackName: null,
      items,
      locale: "es",
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);
});
