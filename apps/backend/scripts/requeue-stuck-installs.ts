/**
 * Re-enqueue MCP installs that never completed: enabled user_servers rows on
 * a running box server that still have no bridge endpoint, installed more
 * than --older-than minutes ago (default 10). Typical cause: the install-mcp
 * job was lost or rejected (2026-11-06: QStash signatures failed behind the
 * proxy, so every install-mcp job got a 401 and QStash gave up).
 *
 * Uses enqueue(), so with QSTASH_TOKEN + APP_URL set the jobs go through
 * QStash (retried); otherwise they run inline in this process. Local-agent
 * servers and the proxy-handled twinmcp-docs MCP are skipped.
 *
 * DRY-RUN by default. Usage (from apps/backend):
 *   npx tsx scripts/requeue-stuck-installs.ts [--env ../../.env.actuelle] [--older-than 10]
 *   npx tsx scripts/requeue-stuck-installs.ts --env ../../.env.actuelle --apply
 */
import { config as loadEnv } from "dotenv";

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const envFile = arg("--env");
if (envFile) loadEnv({ path: envFile, override: true });
loadEnv({ path: ".env.local" });
loadEnv();

const apply = argv.includes("--apply");
const olderThanMin = Number(arg("--older-than") ?? 10);

const { getDb } = await import("../src/db");
const { userServers, servers, mcpServers } = await import("../src/db/schema");
const { and, eq, isNull, lt, ne } = await import("drizzle-orm");
const { enqueue, isQueueEnabled } = await import("../src/lib/queue/qstash");

const cutoff = new Date(Date.now() - olderThanMin * 60_000);
const rows = await getDb()
  .select({
    id: userServers.id,
    mcp: mcpServers.slug,
    server: servers.slug,
    installedAt: userServers.installedAt,
  })
  .from(userServers)
  .innerJoin(servers, eq(servers.id, userServers.serverId))
  .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
  .where(
    and(
      eq(userServers.enabled, true),
      isNull(userServers.endpointUrl),
      eq(servers.status, "running"),
      eq(servers.hostType, "upstash_box"),
      ne(mcpServers.slug, "twinmcp-docs"),
      lt(userServers.installedAt, cutoff)
    )
  );

console.log(
  `${rows.length} stuck install(s) older than ${olderThanMin} min. Queue: ${isQueueEnabled() ? "QStash" : "inline"}.`
);
for (const r of rows)
  console.log(`  - ${r.server} / ${r.mcp}  (installed ${r.installedAt?.toISOString()})`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to re-enqueue.");
  process.exit(0);
}
for (const r of rows) {
  const res = await enqueue({ type: "install-mcp", userServerId: r.id });
  console.log(`  ${r.server} / ${r.mcp}: ${res.mode}${res.messageId ? ` ${res.messageId}` : ""}`);
}
// Inline jobs run in this process: give them time before exiting.
if (!isQueueEnabled() && rows.length) await new Promise((r) => setTimeout(r, 180_000));
process.exit(0);
