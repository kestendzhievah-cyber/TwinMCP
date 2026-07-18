import { Ratelimit } from "@upstash/ratelimit";
import * as Sentry from "@sentry/nextjs";
import { getRedis } from "./redis";
import type { Plan } from "@/db/schema";

const DAILY_LIMITS: Record<Plan, number> = {
  free: Number(process.env.RATE_LIMIT_FREE_DAILY ?? 50),
  pro: Number(process.env.RATE_LIMIT_PRO_DAILY ?? 1000),
  team: Number(process.env.RATE_LIMIT_TEAM_DAILY ?? 5000),
};

const limiters = new Map<Plan, Ratelimit>();

function getLimiter(plan: Plan): Ratelimit {
  const cached = limiters.get(plan);
  if (cached) return cached;
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(DAILY_LIMITS[plan], "24 h"),
    analytics: true,
    prefix: `rl:${plan}`,
  });
  limiters.set(plan, rl);
  return rl;
}

export async function checkRateLimit(userId: string, plan: Plan) {
  // Fail-OPEN: if Upstash Redis isn't configured or is briefly unreachable,
  // getLimiter() (missing env) or .limit() (network) throws. We must NOT let
  // that 500 the MCP proxy / context / libs endpoints — a missing rate limit is
  // far less bad than the whole product being down. Surfaced via warn + Sentry.
  try {
    const { success, limit, remaining, reset } = await getLimiter(plan).limit(userId);
    return { ok: success, limit, remaining, reset };
  } catch (err) {
    console.warn("[rate-limit] disabled — Upstash Redis not available:", err);
    Sentry.captureException(err, { tags: { area: "rate-limit", stage: "check" } });
    const limit = DAILY_LIMITS[plan];
    return { ok: true, limit, remaining: limit, reset: 0 };
  }
}

export function getDailyLimit(plan: Plan): number {
  return DAILY_LIMITS[plan];
}
