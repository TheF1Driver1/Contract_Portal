import { describe, expect, it } from "vitest";
import {
  MIN_COMPS,
  dataFreshness,
  findByMunicipality,
  median,
  municipalityYields,
  normalizeMunicipality,
  prFiscalYear,
  rentComps,
  type MarketListing,
} from "@/lib/market/comps";

const listing = (city: string, rentZestimate: number | null, extra: Partial<MarketListing> = {}): MarketListing => ({
  city,
  beds: 2,
  price: 200_000,
  rentZestimate,
  homeStatus: "FOR_SALE",
  ...extra,
});

describe("normalizeMunicipality", () => {
  it("ignores accents, case, spacing and a trailing PR", () => {
    expect(normalizeMunicipality("Bayamón")).toBe("bayamon");
    expect(normalizeMunicipality("  MAYAGÜEZ ")).toBe("mayaguez");
    expect(normalizeMunicipality("Añasco")).toBe("anasco");
    expect(normalizeMunicipality("San  Juan, PR")).toBe("san juan");
    expect(normalizeMunicipality("Loíza, Puerto Rico")).toBe("loiza");
    expect(normalizeMunicipality(null)).toBe("");
  });

  it("finds CRIM rows regardless of accents", () => {
    const rows = [{ municipality: "Bayamón", inmueble_rate: 9.58 }, { municipality: "Cataño", inmueble_rate: 10.33 }];
    expect(findByMunicipality(rows, "bayamon")?.inmueble_rate).toBe(9.58);
    expect(findByMunicipality(rows, "CATANO")?.municipality).toBe("Cataño");
    expect(findByMunicipality(rows, "Ponce")).toBeNull();
    expect(findByMunicipality(rows, "")).toBeNull();
  });
});

describe("median", () => {
  it("handles odd, even, unsorted and empty input", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(median([Number.NaN, 5])).toBe(5);
  });
});

describe("rentComps", () => {
  const town = ["Bayamón", "Bayamon", "BAYAMON", "Bayamón", "Bayamón"].map((c, i) => listing(c, 1000 + i * 100));

  it("compares rent with the median rentZestimate in the same municipality", () => {
    const comp = rentComps({ rent: 1320, city: "Bayamón" }, [...town, listing("Ponce", 5000)]);
    expect(comp.n).toBe(5);
    expect(comp.median).toBe(1200);
    expect(comp.diffPct).toBe(10);
    expect(comp.matchedOn).toBe("municipality");
  });

  it("hides the median when there are fewer than MIN_COMPS comps", () => {
    const comp = rentComps({ rent: 1000, city: "Bayamón" }, town.slice(0, MIN_COMPS - 1));
    expect(comp.n).toBe(MIN_COMPS - 1);
    expect(comp.median).toBeNull();
    expect(comp.diffPct).toBeNull();
  });

  it("ignores listings without a positive rentZestimate and ignores sale prices", () => {
    const noisy = [...town.slice(0, 4), listing("Bayamón", null, { price: 900_000 }), listing("Bayamón", 0)];
    expect(rentComps({ rent: 1000, city: "Bayamón" }, noisy).n).toBe(4);
  });

  it("narrows to the same bedroom count only when that leaves enough comps", () => {
    const threeBeds = Array.from({ length: 5 }, (_, i) => listing("Bayamón", 2000 + i * 10, { beds: 3 }));
    const narrowed = rentComps({ rent: 2020, city: "Bayamón", beds: 3 }, [...town, ...threeBeds]);
    expect(narrowed).toMatchObject({ n: 5, median: 2020, diffPct: 0, matchedOn: "beds" });

    const fallback = rentComps({ rent: 1200, city: "Bayamón", beds: 4 }, [...town, ...threeBeds]);
    expect(fallback).toMatchObject({ n: 10, matchedOn: "municipality" });
  });

  it("returns no comps for a lease without a municipality", () => {
    expect(rentComps({ rent: 900, city: null }, town)).toMatchObject({ n: 0, median: null });
  });
});

describe("municipalityYields", () => {
  it("computes gross yield and price-to-rent from for-sale listings with a rentZestimate", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => listing("Ponce", 1000, { price: 120_000 })),
      listing("Ponce", 1000, { price: 120_000, homeStatus: "FOR_RENT" }),
      listing("Ponce", null, { price: 50_000 }),
      ...Array.from({ length: 4 }, () => listing("Dorado", 3000, { price: 600_000 })),
    ];
    const [ponce, ...rest] = municipalityYields(rows);
    expect(rest).toEqual([]); // Dorado has only 4
    expect(ponce).toEqual({ city: "Ponce", n: 5, medianPrice: 120_000, medianRent: 1000, grossYieldPct: 10, priceToRent: 10 });
  });

  it("merges accent variants and shows the most common spelling", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => listing("Mayagüez", 900, { price: 108_000 })),
      ...Array.from({ length: 2 }, () => listing("Mayaguez", 900, { price: 108_000 })),
    ];
    expect(municipalityYields(rows)).toMatchObject([{ city: "Mayagüez", n: 5 }]);
  });

  it("sorts by sample size and respects the limit", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => listing("Caguas", 1000)),
      ...Array.from({ length: 7 }, () => listing("Carolina", 1000)),
      ...Array.from({ length: 5 }, () => listing("Arecibo", 1000)),
    ];
    expect(municipalityYields(rows, 2).map((y) => y.city)).toEqual(["Carolina", "Caguas"]);
  });
});

describe("dataFreshness", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("counts whole days and flags data older than 14 days", () => {
    expect(dataFreshness("2026-10-08T06:00:00Z", now)).toEqual({ days: 0, stale: false });
    expect(dataFreshness("2026-09-24T12:00:00Z", now)).toEqual({ days: 14, stale: false });
    expect(dataFreshness("2026-09-23T11:00:00Z", now)).toEqual({ days: 15, stale: true });
    expect(dataFreshness("2026-10-09T00:00:00Z", now)).toEqual({ days: 0, stale: false });
    expect(dataFreshness(null, now)).toBeNull();
    expect(dataFreshness("not a date", now)).toBeNull();
  });
});

describe("prFiscalYear", () => {
  it("starts the fiscal year on July 1 in Puerto Rico", () => {
    expect(prFiscalYear(new Date("2026-10-08T12:00:00Z"))).toBe("2026-2027");
    expect(prFiscalYear(new Date("2026-06-30T12:00:00Z"))).toBe("2025-2026");
    // 2026-07-01 02:00 UTC is still June 30 in Puerto Rico (UTC−4).
    expect(prFiscalYear(new Date("2026-07-01T02:00:00Z"))).toBe("2025-2026");
    expect(prFiscalYear(new Date("2026-07-01T05:00:00Z"))).toBe("2026-2027");
  });
});
