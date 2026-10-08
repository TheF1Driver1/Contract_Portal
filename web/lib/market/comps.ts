// Market comps from the Zillow data (public.zillow_market). Pure functions:
// no I/O, so the API routes and tests share them.
//
// Rent comps compare a lease's rent with Zillow's rentZestimate (estimated
// market rent) of homes in the same municipality, never with sale prices.

/** Below this many comparable listings we don't show a market figure. */
export const MIN_COMPS = 5;

/** Days after which market data is flagged as stale in the UI. */
export const STALE_AFTER_DAYS = 14;

/**
 * Accent-, case- and punctuation-insensitive key for a municipality name, so
 * "Bayamón", "BAYAMON" and "bayamon, PR" match. NFD splits "ó" into "o" plus
 * a combining mark, which we drop.
 */
export function normalizeMunicipality(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/,?\s*(pr|puerto rico)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Finds the row whose `municipality` matches `city` (accent-insensitive). */
export function findByMunicipality<T extends { municipality: string | null }>(rows: readonly T[], city: string | null | undefined): T | null {
  const key = normalizeMunicipality(city);
  if (!key) return null;
  return rows.find((r) => normalizeMunicipality(r.municipality) === key) ?? null;
}

/** Median of the finite numbers in `values`; null when there are none. */
export function median(values: readonly number[]): number | null {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export interface MarketListing {
  city: string | null;
  beds: number | null;
  price: number | null;
  rentZestimate: number | null;
  homeStatus?: string | null;
}

export interface RentComp {
  /** Number of comparable listings found (shown even when too few). */
  n: number;
  /** Median comparable rentZestimate; null when n < MIN_COMPS. */
  median: number | null;
  /** (rent − median) ÷ median, as a percentage rounded to 1 decimal. */
  diffPct: number | null;
  /** Whether comps were narrowed to the same bedroom count. */
  matchedOn: "beds" | "municipality";
}

const positive = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Compares a lease's monthly rent with the median rentZestimate of listings
 * in the same municipality. When `beds` is known and there are at least
 * MIN_COMPS listings with that bedroom count, comps are narrowed to them.
 */
export function rentComps(
  lease: { rent: number; city: string | null; beds?: number | null },
  listings: readonly MarketListing[],
): RentComp {
  const key = normalizeMunicipality(lease.city);
  const sameTown = key
    ? listings.filter((l) => positive(l.rentZestimate) && normalizeMunicipality(l.city) === key)
    : [];

  let pool = sameTown;
  let matchedOn: RentComp["matchedOn"] = "municipality";
  if (lease.beds != null) {
    const sameBeds = sameTown.filter((l) => l.beds === lease.beds);
    if (sameBeds.length >= MIN_COMPS) {
      pool = sameBeds;
      matchedOn = "beds";
    }
  }

  const n = pool.length;
  const med = n >= MIN_COMPS ? median(pool.map((l) => l.rentZestimate as number)) : null;
  const diffPct = med && positive(lease.rent) ? Math.round(((lease.rent - med) / med) * 1000) / 10 : null;
  return { n, median: med, diffPct, matchedOn };
}

/** One lease row as returned by GET /api/market/compare. */
export interface LeaseRentComp {
  contract_id: string;
  property: string | null;
  city: string;
  rent: number;
  n: number;
  median: number | null;
  diff_pct: number | null;
  matched_on: RentComp["matchedOn"];
}

export interface MunicipalityYield {
  city: string;
  /** Listings for sale with both a price and a rentZestimate. */
  n: number;
  medianPrice: number;
  medianRent: number;
  /** Median of annual rentZestimate ÷ price, in percent (1 decimal). */
  grossYieldPct: number;
  /** Median of price ÷ annual rentZestimate (1 decimal). */
  priceToRent: number;
}

/**
 * Gross yield and price-to-rent by municipality, from for-sale listings that
 * carry a rentZestimate. Municipalities with fewer than MIN_COMPS such
 * listings are left out. Sorted by sample size, largest first.
 */
export function municipalityYields(listings: readonly MarketListing[], limit = 8): MunicipalityYield[] {
  type Group = { names: Map<string, number>; rows: { price: number; rent: number }[] };
  const groups = new Map<string, Group>();
  for (const l of listings) {
    if (l.homeStatus != null && l.homeStatus !== "FOR_SALE") continue;
    if (!positive(l.price) || !positive(l.rentZestimate) || !l.city) continue;
    const key = normalizeMunicipality(l.city);
    if (!key) continue;
    const g: Group = groups.get(key) ?? { names: new Map(), rows: [] };
    g.names.set(l.city, (g.names.get(l.city) ?? 0) + 1);
    g.rows.push({ price: l.price, rent: l.rentZestimate });
    groups.set(key, g);
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const out: MunicipalityYield[] = [];
  for (const g of groups.values()) {
    if (g.rows.length < MIN_COMPS) continue;
    // Display the spelling used most often (accented, usually).
    const city = [...g.names.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
    out.push({
      city,
      n: g.rows.length,
      medianPrice: median(g.rows.map((r) => r.price))!,
      medianRent: median(g.rows.map((r) => r.rent))!,
      grossYieldPct: round1(median(g.rows.map((r) => ((r.rent * 12) / r.price) * 100))!),
      priceToRent: round1(median(g.rows.map((r) => r.price / (r.rent * 12)))!),
    });
  }
  return out.sort((a, b) => b.n - a.n || a.city.localeCompare(b.city)).slice(0, limit);
}

/** Whole days between `updatedAt` and `now` (never negative), and whether that is stale. */
export function dataFreshness(updatedAt: string | null | undefined, now: Date = new Date()): { days: number; stale: boolean } | null {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
  return { days, stale: days > STALE_AFTER_DAYS };
}

/**
 * Current Puerto Rico government fiscal year (July 1 – June 30), e.g.
 * "2026-2027" for any date from 2026-07-01 to 2027-06-30.
 */
export function prFiscalYear(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Puerto_Rico", year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
}
