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

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const strictLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(LIMITS.strict, "60 s"),
  prefix: "rl:strict",
});

const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(LIMITS.write, "60 s"),
  prefix: "rl:write",
});

const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(LIMITS.read, "60 s"),
  prefix: "rl:read",
});

const publicLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(LIMITS.public, "60 s"),
  prefix: "rl:public",
});

async function check(
  limiter: Ratelimit,
  id: string
): Promise<NextResponse | null> {
  const { success, limit, remaining, reset } = await limiter.limit(id);
  if (success) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
      },
    }
  );
}

export const rateLimitStrict = (id: string) => check(strictLimiter, id);
export const rateLimitWrite = (id: string) => check(writeLimiter, id);
export const rateLimitRead = (id: string) => check(readLimiter, id);
export const rateLimitPublic = (ip: string) => check(publicLimiter, ip);
