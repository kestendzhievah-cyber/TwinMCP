import { Ratelimit } from "@upstash/ratelimit";
import * as Sentry from "@sentry/nextjs";
import { getRedis } from "@/lib/redis";

// Rate limits applied to authenticated dashboard operations (API key
// management, plan changes, etc.). Separate from the per-plan usage limit
// in lib/rate-limit.ts — those are about MCP request volume, these are
// about abuse of write endpoints.
//
// Lazy-init: instantiating Ratelimit calls getRedis() which throws if the
// Upstash env vars are missing. During `next build`, Next collects page
// data by loading each route module, so top-level instantiation would
// crash the build in any environment that doesn't surface those vars at
// build time (e.g. Dokploy injects env only at runtime).

let cachedLimiters: { burst: Ratelimit; sustained: Ratelimit } | null = null;

function getLimiters() {
  if (cachedLimiters) return cachedLimiters;
  const redis = getRedis();
  cachedLimiters = {
    // Short window: stops local hammering / accidental loops.
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      analytics: true,
      prefix: "auth_rl:burst",
    }),
    // Long window: caps daily abuse even with patient attackers.
    sustained: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(50, "1 h"),
      analytics: true,
      prefix: "auth_rl:sustained",
    }),
  };
  return cachedLimiters;
}

export type AuthRateLimitResult =
  | { ok: true }
  | { ok: false; window: "burst" | "sustained"; reset: number; limit: number };

export async function checkAuthWriteLimit(
  userId: string,
  action: string
): Promise<AuthRateLimitResult> {
  // Fail-open if Redis isn't configured. The endpoint stays usable; the
  // missing rate limit is logged so we notice in observability.
  let limiters;
  try {
    limiters = getLimiters();
  } catch (err) {
    console.warn("[auth rate-limit] disabled — Upstash env not configured:", err);
    return { ok: true };
  }

  const key = `${userId}:${action}`;

  // Fail-open on a network/DNS failure too. `.limit()` throws (e.g. "fetch
  // failed — getaddrinfo ENOTFOUND <host>.upstash.io") when the Redis REST host
  // is unreachable or no longer exists. That must not turn API-key creation or
  // billing into a 500: a missing abuse limit is far less bad than a locked-out
  // dashboard. Mirrors lib/rate-limit.ts. Surfaced via warn + Sentry.
  try {
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
  } catch (err) {
    console.warn("[auth rate-limit] disabled — Upstash Redis unreachable:", err);
    Sentry.captureException(err, { tags: { area: "auth-rate-limit", action } });
  }

  return { ok: true };
}
