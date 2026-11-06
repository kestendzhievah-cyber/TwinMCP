// Safety net for MCP installs that never completed.
//
// An install-mcp job can be lost: QStash gives up after its retries (on
// 2026-11-06 every job was rejected with a 401), or an inline job dies with
// the process. The MCP then sits on "still installing" forever, with no
// bridge endpoint. This job re-enqueues install-mcp for those rows, with a
// small attempt budget so a genuinely broken MCP is not retried for ever.
//
// Attempts are counted per process (globalThis), which fits the single
// production container: a restart simply grants a fresh budget.

const MIN = 60_000;

export interface StuckInstall {
  id: string;
  installedAt: Date | null;
}

export interface RepairAttempt {
  count: number;
  lastAt: number;
}

export interface RepairOptions {
  /** An install younger than this is still legitimately in progress. */
  minAgeMs: number;
  /** Retries per row in this process. */
  maxAttempts: number;
  /** Wait after the n-th retry: baseBackoffMs * 2^(n-1). */
  baseBackoffMs: number;
}

export const REPAIR_DEFAULTS: RepairOptions = {
  minAgeMs: 15 * MIN,
  maxAttempts: 3,
  baseBackoffMs: 30 * MIN,
};

/** Pure: which stuck rows to retry now, and which have used their budget. */
export function selectRepairs(
  rows: readonly StuckInstall[],
  attempts: ReadonlyMap<string, RepairAttempt>,
  now: number,
  opts: RepairOptions = REPAIR_DEFAULTS
): { retry: string[]; exhausted: string[] } {
  const retry: string[] = [];
  const exhausted: string[] = [];
  for (const row of rows) {
    const installed = row.installedAt?.getTime() ?? 0;
    if (now - installed < opts.minAgeMs) continue;
    const a = attempts.get(row.id);
    if (!a) {
      retry.push(row.id);
      continue;
    }
    if (a.count >= opts.maxAttempts) {
      exhausted.push(row.id);
      continue;
    }
    if (now - a.lastAt >= opts.baseBackoffMs * 2 ** (a.count - 1)) retry.push(row.id);
  }
  return { retry, exhausted };
}

const STATE_KEY = Symbol.for("twinmcp.repairInstalls.attempts");
function attemptsMap(): Map<string, RepairAttempt> {
  const g = globalThis as unknown as Record<symbol, Map<string, RepairAttempt> | undefined>;
  return (g[STATE_KEY] ??= new Map());
}

export interface RepairResult {
  stuck: number;
  requeued: number;
  exhausted: number;
  errors: number;
}

/** Find stuck installs (enabled, no endpoint, running box server) and re-enqueue them. */
export async function runRepairInstalls(now = Date.now()): Promise<RepairResult> {
  const { getDb } = await import("@/db");
  const { userServers, servers, mcpServers } = await import("@/db/schema");
  const { and, eq, isNull, ne } = await import("drizzle-orm");
  const { enqueue } = await import("@/lib/queue/qstash");

  const rows = await getDb()
    .select({ id: userServers.id, installedAt: userServers.installedAt })
    .from(userServers)
    .innerJoin(servers, eq(servers.id, userServers.serverId))
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(
      and(
        eq(userServers.enabled, true),
        isNull(userServers.endpointUrl),
        eq(servers.status, "running"),
        eq(servers.hostType, "upstash_box"),
        ne(mcpServers.slug, "twinmcp-docs")
      )
    );

  const attempts = attemptsMap();
  // Forget rows that are no longer stuck (installed, removed or disabled).
  const live = new Set(rows.map((r) => r.id));
  for (const id of attempts.keys()) if (!live.has(id)) attempts.delete(id);

  const { retry, exhausted } = selectRepairs(rows, attempts, now);
  let requeued = 0;
  let errors = 0;
  for (const id of retry) {
    const prev = attempts.get(id);
    attempts.set(id, { count: (prev?.count ?? 0) + 1, lastAt: now });
    try {
      await enqueue({ type: "install-mcp", userServerId: id });
      requeued += 1;
    } catch (err) {
      errors += 1;
      console.error(`[repair-installs] enqueue ${id} failed:`, err);
    }
  }
  return { stuck: rows.length, requeued, exhausted: exhausted.length, errors };
}
