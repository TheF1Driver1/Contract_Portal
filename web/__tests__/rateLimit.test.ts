import { describe, expect, it } from "vitest";
import { rateLimitStrict } from "@/lib/rate-limit";

// No UPSTASH_* env in tests, so the in-memory fallback is exercised.
describe("rate limit without Redis", () => {
  it("allows up to the limit, then answers 429", async () => {
    const id = `user-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(await rateLimitStrict(id)).toBeNull();
    }
    const blocked = await rateLimitStrict(id);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("tracks callers separately", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimitStrict(a);
    expect((await rateLimitStrict(a))?.status).toBe(429);
    expect(await rateLimitStrict(b)).toBeNull();
  });
});
