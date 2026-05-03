import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 5 req/min — heavy ops: /api/generate, /api/send
const strictLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:strict",
});

// 20 req/min — write ops: contract mutations, watchlist, investment, geocode
const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  prefix: "rl:write",
});

// 60 req/min — read ops: authenticated GETs
const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "rl:read",
});

// 30 req/min — public IP-keyed: market/*, crim-rate
const publicLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
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
