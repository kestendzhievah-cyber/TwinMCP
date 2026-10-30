import { NextResponse } from "next/server";
import { sql, eq, count } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, mcpServers } from "@/db/schema";
import { isStubMode } from "@/lib/upstash/box-client";
import { isConfigEncryptionReady } from "@/lib/crypto/config-encryption";
import { isQueueEnabled } from "@/lib/queue/qstash";
import { getRedis } from "@/lib/redis";
import { probeStripeAccount, type StripeAccountHealth } from "@/lib/stripe";
import { METER_STALE_MS, lastMeterRun, lastSnapshotAt } from "@/lib/wallet/compute-meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

// The billing probe costs a Stripe API call, and the container healthcheck
// hits this route every few seconds: a definitive answer is cached for 10
// minutes per process, a transient one ("unreachable") for 1 minute.
const BILLING_TTL_MS = 10 * 60_000;
const BILLING_RETRY_MS = 60_000;
let billingCache: { at: number; ttl: number; account: StripeAccountHealth } | null = null;

async function billingAccount(): Promise<StripeAccountHealth> {
  const now = Date.now();
  if (billingCache && now - billingCache.at < billingCache.ttl) return billingCache.account;
  // probeStripeAccount never throws and is bounded at 1.5 s. Top-ups use
  // inline price_data, so there are no price ids to verify any more.
  const account = await probeStripeAccount(1500);
  billingCache = {
    at: now,
    ttl: account === "unreachable" ? BILLING_RETRY_MS : BILLING_TTL_MS,
    account,
  };
  return account;
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
  const accountPromise = billingAccount();

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

  // Wallet top-up readiness. Never part of the top-level status (a Stripe gap
  // must not flap the container), never a value: only whether the secret key
  // reaches this Stripe account and the webhook secret (which credits paid
  // top-ups) is set. "unconfigured" = STRIPE_SECRET_KEY unset (local dev).
  const account = await accountPromise;
  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  const billingReady = account === "configured" && webhookConfigured;
  const billingBlockers: string[] = [];
  if (account === "unconfigured") {
    billingBlockers.push("STRIPE_SECRET_KEY not set — top-ups are disabled");
  } else if (account === "invalid") {
    billingBlockers.push("STRIPE_SECRET_KEY rejected by Stripe — top-ups fail");
  } else if (account === "unreachable") {
    billingBlockers.push("Stripe API did not answer within 1.5 s — account not verified");
  }
  if (!webhookConfigured) {
    billingBlockers.push("STRIPE_WEBHOOK_SECRET not set — paid top-ups are never credited");
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

  // Prepaid wallet: compute is billed by the meter-boxes cron. A meter that
  // stopped means compute is used without being billed. lastMeterAt is the
  // later of this process's last run and the newest snapshot in the DB (which
  // survives restarts). Booleans and timestamps only.
  const meterRun = lastMeterRun();
  const snapshotAt = dbOk ? await lastSnapshotAt() : null;
  const lastMeterAt =
    [meterRun?.at ?? null, snapshotAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const meterAgeMs = lastMeterAt ? Date.now() - lastMeterAt.getTime() : null;
  const meterStale = boxConfigured && (meterAgeMs === null || meterAgeMs > METER_STALE_MS);
  const walletBlockers: string[] = [];
  const walletWarnings: string[] = [];
  if (meterStale) {
    walletBlockers.push(
      lastMeterAt
        ? `Compute metering last ran ${Math.round((meterAgeMs ?? 0) / 60_000)} min ago (> 15 min): schedule /api/cron/meter-boxes every 5 min`
        : "Compute metering has never run: schedule /api/cron/meter-boxes every 5 min"
    );
  }
  // null = no run in this process yet (unknown).
  const costFieldsPresent = meterRun?.costFieldsPresent ?? null;
  if (costFieldsPresent === false) {
    walletWarnings.push(
      "Upstash returned no total_compute_cost_usd: compute is billed from CPU time or a wall-clock estimate"
    );
  }
  const enforceEnabled = process.env.WALLET_ENFORCE_ENABLED === "true";
  if (!enforceEnabled) {
    walletWarnings.push(
      "WALLET_ENFORCE_ENABLED is not 'true': boxes pause at zero, but free-credit runtimes are never deleted (no deletion warnings)"
    );
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
        stripeAccount: account,
        webhookSecret: webhookConfigured ? "configured" : "missing",
        blockers: billingBlockers,
      },
      wallet: {
        lastMeterAt: lastMeterAt?.toISOString() ?? null,
        meterStale,
        lastMeterErrors: meterRun?.errors ?? null,
        costFieldsPresent,
        // Pausing at zero always runs; "pause_only" = deletion countdown off.
        enforcement: enforceEnabled ? "enabled" : "pause_only",
        blockers: walletBlockers,
        warnings: walletWarnings,
      },
      timestamp: new Date().toISOString(),
    },
    { status: code }
  );
}
