import { NextResponse } from "next/server";
import { sql, eq, count } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, mcpServers } from "@/db/schema";
import { isStubMode } from "@/lib/upstash/box-client";
import { isConfigEncryptionReady } from "@/lib/crypto/config-encryption";
import { isQueueEnabled } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

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

  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable — everything below depends on it.
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

  const status = dbOk ? "ok" : "degraded";
  const code = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      service: "twinmcp-backend",
      version: process.env.npm_package_version ?? "0.1.0",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      db: dbOk ? "connected" : "unreachable",
      mcp: {
        ready: mcpReady,
        boxRuntime: boxConfigured ? "configured" : "stub",
        configEncryption: encryptionReady ? "configured" : "missing",
        queue: isQueueEnabled() ? "qstash" : "inline",
        catalogCount,
        runningServers,
        blockers,
      },
      timestamp: new Date().toISOString(),
    },
    { status: code }
  );
}
