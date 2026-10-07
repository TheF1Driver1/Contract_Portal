import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// ── Rate limit config ────────────────────────────────────────────────────────
// Edit these numbers to adjust limits. All values = requests per 60 seconds.
//
// STRICT  — 5/min  — /api/generate, /api/send (Twilio + Resend cost per call)
// WRITE   — 20/min — contract mutations, watchlist, investment, geocode (per user)
// READ    — 60/min — authenticated GETs (per user)
// PUBLIC  — 30/min — /api/market/*, /api/crim-rate (per IP, no auth required)
const LIMITS = {
  strict: 5,
  write: 20,
  read: 60,
  public: 30,
} as const;
// ────────────────────────────────────────────────────────────────────────────

const redisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

function makeLimiter(limit: number, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, "60 s"),
    prefix,
  });
}

const strictLimiter = makeLimiter(LIMITS.strict, "rl:strict");
const writeLimiter  = makeLimiter(LIMITS.write,  "rl:write");
const readLimiter   = makeLimiter(LIMITS.read,   "rl:read");
const publicLimiter = makeLimiter(LIMITS.public, "rl:public");

// Per-instance fallback used when Redis is not configured or unreachable.
// Fluid compute reuses instances, so this still caps bursts without making
// every request fail (the Upstash host vanished in Sep 2026 and returned 500s).
const memoryHits = new Map<string, number[]>();

function memoryLimit(key: string, limit: number) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (memoryHits.get(key) ?? []).filter((t) => t > windowStart);
  const success = hits.length < limit;
  if (success) hits.push(now);
  memoryHits.set(key, hits);
  if (memoryHits.size > 10_000) memoryHits.clear(); // bound memory
  return { success, limit, remaining: Math.max(0, limit - hits.length), reset: (hits[0] ?? now) + 60_000 };
}

async function check(
  limiter: Ratelimit | null,
  prefix: string,
  max: number,
  id: string
): Promise<NextResponse | null> {
  let result: { success: boolean; limit: number; remaining: number; reset: number };
  try {
    result = limiter ? await limiter.limit(id) : memoryLimit(`${prefix}:${id}`, max);
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", msg: "rate-limit redis unavailable; using memory", prefix, err: String(err) }));
    result = memoryLimit(`${prefix}:${id}`, max);
  }
  const { success, limit, remaining, reset } = result;
  if (success) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
      },
    }
  );
}

export const rateLimitStrict = (id: string) => check(strictLimiter, "rl:strict", LIMITS.strict, id);
export const rateLimitWrite = (id: string) => check(writeLimiter, "rl:write", LIMITS.write, id);
export const rateLimitRead = (id: string) => check(readLimiter, "rl:read", LIMITS.read, id);
export const rateLimitPublic = (ip: string) => check(publicLimiter, "rl:public", LIMITS.public, ip);
