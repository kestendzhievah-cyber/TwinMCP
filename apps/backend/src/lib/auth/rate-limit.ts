import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

// Rate limits applied to authenticated dashboard operations (API key
// management, plan changes, etc.). Separate from the per-plan usage limit
// in lib/rate-limit.ts — those are about MCP request volume, these are
// about abuse of write endpoints.
const limiters = {
  // Short window: stops local hammering / accidental loops.
  burst: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "5 m"),
    analytics: true,
    prefix: "auth_rl:burst",
  }),
  // Long window: caps daily abuse even with patient attackers.
  sustained: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(50, "1 h"),
    analytics: true,
    prefix: "auth_rl:sustained",
  }),
};

export type AuthRateLimitResult =
  | { ok: true }
  | { ok: false; window: "burst" | "sustained"; reset: number; limit: number };

export async function checkAuthWriteLimit(
  userId: string,
  action: string
): Promise<AuthRateLimitResult> {
  const key = `${userId}:${action}`;

  const burst = await limiters.burst.limit(key);
  if (!burst.success) {
    return { ok: false, window: "burst", reset: burst.reset, limit: burst.limit };
  }

  const sustained = await limiters.sustained.limit(key);
  if (!sustained.success) {
    return {
      ok: false,
      window: "sustained",
      reset: sustained.reset,
      limit: sustained.limit,
    };
  }

  return { ok: true };
}
