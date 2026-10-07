import { describe, expect, it } from "vitest";
import { addDays, daysBetween, pickReminder } from "@/lib/reminders";

const triggers = [
  { id: "t60", days_before: 60 },
  { id: "t30", days_before: 30 },
  { id: "t7", days_before: 7 },
];

describe("pickReminder", () => {
  it("sends nothing before the first trigger is due", () => {
    expect(pickReminder(triggers, 61, new Set())).toEqual({ send: null, skip: [] });
  });

  it("sends the 60-day reminder on day 60", () => {
    expect(pickReminder(triggers, 60, new Set()).send?.id).toBe("t60");
  });

  it("catches up after a missed run instead of skipping", () => {
    expect(pickReminder(triggers, 58, new Set()).send?.id).toBe("t60");
  });

  it("sends only the closest due trigger and skips the stale ones", () => {
    const r = pickReminder(triggers, 10, new Set());
    expect(r.send?.id).toBe("t30");
    expect(r.skip.map((t) => t.id)).toEqual(["t60"]);
  });

  it("never repeats a handled trigger", () => {
    expect(pickReminder(triggers, 30, new Set(["t60", "t30"])).send).toBeNull();
  });

  it("ignores leases that already ended", () => {
    expect(pickReminder(triggers, -1, new Set()).send).toBeNull();
  });
});

describe("date helpers", () => {
  it("counts whole UTC days", () => {
    expect(daysBetween("2026-10-07", "2026-11-06")).toBe(30);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
