import { NextResponse } from "next/server";
import { sql, eq, count } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, mcpServers } from "@/db/schema";
import { isStubMode } from "@/lib/upstash/box-client";
import { isConfigEncryptionReady } from "@/lib/crypto/config-encryption";
import { isQueueEnabled } from "@/lib/queue/qstash";
import { getRedis } from "@/lib/redis";
import { probePrice, TRIAL_DAYS, type PriceHealth } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

// The billing probe costs two Stripe API calls, and the container healthcheck
// hits this route every few seconds: a definitive answer is cached for 10
// minutes per process, a transient one ("unreachable") for 1 minute.
const BILLING_TTL_MS = 10 * 60_000;
const BILLING_RETRY_MS = 60_000;
let billingCache: {
  at: number;
  ttl: number;
  monthly: PriceHealth;
  yearly: PriceHealth;
} | null = null;

async function billingPrices(): Promise<{ monthly: PriceHealth; yearly: PriceHealth }> {
  const now = Date.now();
  if (billingCache && now - billingCache.at < billingCache.ttl) return billingCache;
  // probePrice never throws and is bounded at 1.5 s each; both run in parallel.
  const [monthly, yearly] = await Promise.all([
    probePrice("monthly", 1500),
    probePrice("yearly", 1500),
  ]);
  const transient = monthly === "unreachable" || yearly === "unreachable";
  billingCache = { at: now, ttl: transient ? BILLING_RETRY_MS : BILLING_TTL_MS, monthly, yearly };
  return { monthly, yearly };
}

/**
 * Health + MCP-readiness probe.
 *
 * The top-level `status`/HTTP code stays driven by DB connectivity ONLY, so the
 * Dokploy container healthcheck and the deploy smoke test keep their existing
 * semantics (a config gap must not flap the container).
 *
 * The `mcp` block is the diagnostic for "clients can't connect an MCP to their
 * LLM": it reports — WITHOUT leaking any secret value — whether each runtime
 * dependency of that exact flow is configured. `mcp.ready` is true only when the
 * whole per-user MCP → LLM path can actually work end-to-end. Curl it against a
 * live deploy to pinpoint the blocker:
 *
 *   curl -s https://<your-domain>/api/health | jq .mcp
 */
export async function GET() {
  const db = getDb();
  // Started first so the Stripe round-trips overlap the DB and Redis probes.
  const pricesPromise = billingPrices();

  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable — everything below depends on it.
  }

  // Upstash Redis (rate limits + auth abuse limits). Non-fatal: both limiters
  // fail open, but a dead host (e.g. the database was deleted and the REST URL
  // still points at it → getaddrinfo ENOTFOUND) means every write is unlimited
  // and Sentry fills up — worth seeing here. Bounded so a hanging host cannot
  // stall the container healthcheck.
  let redisState: "connected" | "unreachable" | "unconfigured" = "unconfigured";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await Promise.race([
        getRedis().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
      ]);
      redisState = "connected";
    } catch {
      redisState = "unreachable";
    }
  }

  // Pro checkout readiness. Never part of the top-level status (a Stripe gap
  // must not flap the container), never a value: only whether each configured
  // price id exists in this Stripe account/mode and bills at the right
  // interval. "unconfigured" = STRIPE_SECRET_KEY unset (local dev).
  const prices = await pricesPromise;
  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  const billingReady =
    prices.monthly === "configured" && prices.yearly === "configured" && webhookConfigured;
  const billingBlockers: string[] = [];
  if (prices.monthly === "unconfigured") {
    billingBlockers.push("STRIPE_SECRET_KEY not set — checkout is disabled");
  } else {
    if (prices.monthly === "missing" || prices.yearly === "missing") {
      billingBlockers.push(
        "STRIPE_PRO_MONTHLY_PRICE_ID / STRIPE_PRO_YEARLY_PRICE_ID not set — Pro checkout returns 400"
      );
    }
    if (prices.monthly === "invalid" || prices.yearly === "invalid") {
      billingBlockers.push("Stripe price ids invalid — Pro checkout returns 400");
    }
    if (prices.monthly === "unreachable" || prices.yearly === "unreachable") {
      billingBlockers.push("Stripe API did not answer within 1.5 s — prices not verified");
    }
  }
  if (!webhookConfigured) {
    billingBlockers.push("STRIPE_WEBHOOK_SECRET not set — paid plans are never applied");
  }

  // Runtime config for the MCP → LLM flow. Booleans/counts only (never values).
  const boxConfigured = !isStubMode(); // UPSTASH_BOX_API_KEY present
  const encryptionReady = isConfigEncryptionReady(); // CONFIG_ENCRYPTION_KEY valid 32-byte

  // Catalog must be seeded, else there is nothing to install/connect. A count of
  // 0 with a healthy DB almost always means `seed:mcps` never ran on this DB.
  let catalogCount: number | null = null;
  let runningServers: number | null = null;
  if (dbOk) {
    try {
      const [c] = await db.select({ n: count() }).from(mcpServers);
      catalogCount = c?.n ?? 0;
    } catch {
      catalogCount = null;
    }
    try {
      const [r] = await db
        .select({ n: count() })
        .from(servers)
        .where(eq(servers.status, "running"));
      runningServers = r?.n ?? 0;
    } catch {
      runningServers = null;
    }
  }

  // The MCP → LLM path is only truly usable when the box runtime + config
  // encryption are configured AND the catalog has at least one MCP to install.
  const mcpReady = boxConfigured && encryptionReady && (catalogCount ?? 0) > 0;

  const blockers: string[] = [];
  if (!boxConfigured) blockers.push("UPSTASH_BOX_API_KEY not set (runtimes run in stub mode)");
  if (!encryptionReady) blockers.push("CONFIG_ENCRYPTION_KEY missing or not a 32-byte hex key");
  if (dbOk && (catalogCount ?? 0) === 0) blockers.push("MCP catalog empty — run `seed:mcps`");
  // Surfaced next to the runtime blockers too: it is the one billing gap that
  // turns every Pro click into an error page.
  if (prices.monthly === "invalid" || prices.yearly === "invalid") {
    blockers.push("Stripe price ids invalid — Pro checkout returns 400");
  }

  const status = dbOk ? "ok" : "degraded";
  const code = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      service: "twinmcp-backend",
      version: process.env.npm_package_version ?? "0.1.0",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      db: dbOk ? "connected" : "unreachable",
      redis: redisState,
      mcp: {
        ready: mcpReady,
        boxRuntime: boxConfigured ? "configured" : "stub",
        configEncryption: encryptionReady ? "configured" : "missing",
        queue: isQueueEnabled() ? "qstash" : "inline",
        catalogCount,
        runningServers,
        blockers,
      },
      billing: {
        ready: billingReady,
        trialDays: TRIAL_DAYS,
        monthlyPrice: prices.monthly,
        yearlyPrice: prices.yearly,
        webhookSecret: webhookConfigured ? "configured" : "missing",
        blockers: billingBlockers,
      },
      timestamp: new Date().toISOString(),
    },
    { status: code }
  );
}
