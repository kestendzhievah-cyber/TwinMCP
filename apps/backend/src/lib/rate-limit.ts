import { Ratelimit } from "@upstash/ratelimit";
import * as Sentry from "@sentry/nextjs";
import { getRedis } from "./redis";

// Per-minute ABUSE limiter for the MCP proxy, the playground and the docs API.
//
// Since 2026-10-29 there is no daily tool-call quota: usage is paid from the
// prepaid wallet, and the balance is the limit (lib/wallet/*, enforced by the
// tool-call gate, which FAILS CLOSED). This limiter only stops a runaway loop
// or a scripted flood from one account. It FAILS OPEN: prod Redis may be down,
// and a missing abuse limit is far less bad than the product being down.

/** Tool calls / docs requests per user per minute (env RATE_LIMIT_PER_MINUTE). */
export const ABUSE_LIMIT_PER_MINUTE = (() => {
  const n = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600);
  return Number.isInteger(n) && n > 0 ? n : 600;
})();

export interface AbuseLimitResult {
  ok: boolean;
  /** Requests allowed per one-minute window. */
  limit: number;
  /** Requests left in the window (0 once rejected). */
  remaining: number;
  /** Epoch ms when the window resets (0 when the limiter is unavailable). */
  reset: number;
}

let limiter: Ratelimit | null = null;

// Short-circuits a user already known to be over the window without a Redis
// round-trip. Per-process (prod is a single container).
const ephemeralCache = new Map<string, number>();

function getLimiter(): Ratelimit {
  if (limiter) return limiter;
  limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(ABUSE_LIMIT_PER_MINUTE, "1 m"),
    // analytics adds extra Redis commands per .limit() — not worth it on the
    // per-request hot path.
    analytics: false,
    ephemeralCache,
    prefix: "rl:min",
  });
  return limiter;
}

/**
 * Per-user, per-minute abuse limit. Fail-OPEN: when Upstash Redis is
 * unconfigured or unreachable the request is allowed (warn + Sentry).
 */
export async function checkAbuseLimit(userId: string): Promise<AbuseLimitResult> {
  try {
    const { success, limit, remaining, reset } = await getLimiter().limit(userId);
    return { ok: success, limit, remaining, reset };
  } catch (err) {
    console.warn("[rate-limit] disabled — Upstash Redis not available:", err);
    Sentry.captureException(err, { tags: { area: "rate-limit", stage: "check" } });
    return {
      ok: true,
      limit: ABUSE_LIMIT_PER_MINUTE,
      remaining: ABUSE_LIMIT_PER_MINUTE,
      reset: 0,
    };
  }
}
