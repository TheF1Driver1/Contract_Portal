// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = () => ({});
    limit = limitMock;
  },
}));

async function loadModule() {
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  return import("@/lib/rate-limit");
}

describe("rate-limit", () => {
  beforeEach(() => {
    limitMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("allows the request when under the limit", async () => {
    limitMock.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: Date.now() });
    const { rateLimitStrict } = await loadModule();
    expect(await rateLimitStrict("u1")).toBeNull();
  });

  it("returns 429 when over the limit", async () => {
    limitMock.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: Date.now() + 30_000 });
    const { rateLimitStrict } = await loadModule();
    const res = await rateLimitStrict("u1");
    expect(res?.status).toBe(429);
  });

  it("fails open when Redis is unreachable", async () => {
    limitMock.mockRejectedValue(new TypeError("fetch failed"));
    const { rateLimitRead } = await loadModule();
    expect(await rateLimitRead("u1")).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
