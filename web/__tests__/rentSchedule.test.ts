import { describe, expect, it } from "vitest";
import { chargesToPost, dueDateFor, lateFeeFor, rentCoverage, rentPeriods, summarize, type Charge, type LedgerContract } from "@/lib/rent/schedule";

const lease: LedgerContract = {
  id: "c1",
  owner_id: "o1",
  rent_amount: 850,
  payment_due_day: 1,
  lease_start: "2026-07-01",
  lease_end: "2027-06-30",
  late_fee_type: "fixed",
  late_fee_grace_period_days: 5,
  late_fee_fixed_amount: 50,
  late_fee_daily_amount: 0,
};
const rent = (period: string, due = period, amount = 850): Charge => ({ kind: "rent", period, due_date: due, amount });

describe("due dates and periods", () => {
  it("clamps the payment day to the month", () => {
    expect(dueDateFor("2027-02-01", 31)).toBe("2027-02-28");
    expect(dueDateFor("2026-10-01", 5)).toBe("2026-10-05");
  });

  it("posts from the ledger start, 5 days ahead, inside the lease", () => {
    expect(rentPeriods(lease, "2026-09-15", "2026-10-08").map((p) => p.due_date)).toEqual(["2026-10-01"]);
    expect(rentPeriods(lease, "2026-09-01", "2026-10-27").map((p) => p.due_date)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(rentPeriods({ ...lease, lease_end: "2026-10-15" }, "2026-09-01", "2026-12-31").map((p) => p.due_date)).toEqual(["2026-09-01", "2026-10-01"]);
  });
});

describe("coverage", () => {
  it("applies payments to the oldest rent first", () => {
    const cov = rentCoverage([rent("2026-09-01"), rent("2026-10-01")], [
      { amount: 500, received_on: "2026-09-03" },
      { amount: 600, received_on: "2026-09-20" },
      { amount: 600, received_on: "2026-10-02" },
    ]);
    expect(cov.get("2026-09-01")).toBe("2026-09-20");
    expect(cov.get("2026-10-01")).toBe("2026-10-02");
  });

  it("leaves a month open while short", () => {
    const cov = rentCoverage([rent("2026-09-01")], [{ amount: 849.99, received_on: "2026-09-01" }]);
    expect(cov.get("2026-09-01")).toBeNull();
  });
});

describe("late fees", () => {
  it("charges nothing inside the grace period or when paid in time", () => {
    expect(lateFeeFor(lease, "2026-10-01", null, "2026-10-06")).toBe(0);
    expect(lateFeeFor(lease, "2026-10-01", "2026-10-06", "2026-10-20")).toBe(0);
  });

  it("charges the fixed fee once late", () => {
    expect(lateFeeFor(lease, "2026-10-01", null, "2026-10-07")).toBe(50);
    expect(lateFeeFor(lease, "2026-10-01", "2026-10-09", "2026-10-30")).toBe(50);
  });

  it("accrues daily until paid or the next due date", () => {
    const daily = { ...lease, late_fee_type: "both" as const, late_fee_daily_amount: 5 };
    expect(lateFeeFor(daily, "2026-10-01", null, "2026-10-09")).toBe(65); // 50 + 3 days
    expect(lateFeeFor(daily, "2026-10-01", "2026-10-08", "2026-10-25")).toBe(60);
    expect(lateFeeFor(daily, "2026-10-01", null, "2026-12-15")).toBe(50 + 5 * 26); // capped at Nov 1
  });

  it("is zero when the lease has no fee", () => {
    expect(lateFeeFor({ ...lease, late_fee_fixed_amount: 0 }, "2026-10-01", null, "2026-10-20")).toBe(0);
  });
});

describe("chargesToPost", () => {
  it("posts missing rent and the late fee, and is idempotent", () => {
    const first = chargesToPost(lease, "2026-10-01", "2026-10-08", [], []);
    expect(first).toEqual([
      { kind: "rent", period: "2026-10-01", due_date: "2026-10-01", amount: 850 },
      { kind: "late_fee", period: "2026-10-01", due_date: "2026-10-07", amount: 50 },
    ]);
    const stored: Charge[] = first.map((c) => ({ ...c }));
    expect(chargesToPost(lease, "2026-10-01", "2026-10-09", stored, [])).toEqual([]);
  });

  it("never re-posts a voided late fee", () => {
    const stored: Charge[] = [rent("2026-10-01"), { kind: "late_fee", period: "2026-10-01", due_date: "2026-10-07", amount: 50, voided: true }];
    expect(chargesToPost(lease, "2026-10-01", "2026-10-20", stored, [])).toEqual([]);
  });
});

describe("summarize", () => {
  it("splits overdue from upcoming", () => {
    const s = summarize([rent("2026-09-01"), rent("2026-10-01"), rent("2026-11-01")], [{ amount: 850, received_on: "2026-09-02" }], "2026-10-28");
    expect(s).toEqual({ charged: 2550, paid: 850, balance: 1700, overdue: 850, nextDue: { date: "2026-11-01", amount: 850 } });
  });
});
