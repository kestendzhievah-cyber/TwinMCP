import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers, userServers, mcpServers, type ServerStatus } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";
import { keepWarm } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { isRuntimeGone, pauseFailureAction } from "@/lib/server-lifecycle";
import {
  BRIDGE_BASE_PORT,
  INIT_SCRIPT_PATH,
  buildInitScript,
  buildLauncherScript,
  healthcheckMcp,
  launcherPath,
  logFileForMcp,
  startBridgeCommand,
  stopBridgeCommand,
} from "@/lib/upstash/mcp-bridge";
import {
  decryptConfig,
  encryptConfig,
  type EncryptedPayload,
} from "@/lib/crypto/config-encryption";
import { MissingSecretError, resolveSecretRefs } from "@/lib/vault/resolve";
import { emitWebhookEvent } from "@/lib/webhooks/emit";

export const TWINMCP_DOCS_SLUG = "twinmcp-docs";

/** Where users add credit; quoted in every "out of credit" message. */
export const TOPUP_URL = "https://twinmcp.fr/dashboard/billing";

/**
 * The user may not start or wake compute: their wallet is empty, or their
 * promotional credit hit its compute cost cap (lib/wallet/compute-meter.ts).
 * Thrown by resumeServer and assertComputeAllowed; the MCP proxy maps it to
 * HTTP 402 / JSON-RPC -32008 (contract W2), routes to a 402 response.
 */
export class InsufficientCreditError extends Error {
  readonly code = "insufficient_credit" as const;
  readonly httpStatus = 402;
  readonly rpcCode = -32008;
  readonly topupUrl = TOPUP_URL;
  constructor(
    readonly userId: string,
    readonly reason: "no_credit" | "promo_cost_cap"
  ) {
    super(
      reason === "no_credit"
        ? `Your TwinMCP credit is used up. Top up at ${TOPUP_URL}`
        : `Your promotional credit reached its compute limit. Add paid credit at ${TOPUP_URL} to keep this server running.`
    );
    this.name = "InsufficientCreditError";
  }
}

export function isInsufficientCreditError(err: unknown): err is InsufficientCreditError {
  return err instanceof InsufficientCreditError;
}

/**
 * Refuse to start or wake compute for a user without credit (fails closed on a
 * DB error). Routes that create or start a server call this before enqueuing
 * provision-server so the user gets a 402 instead of a silent no-op.
 */
export async function assertComputeAllowed(userId: string): Promise<void> {
  const { checkComputeAllowed } = await import("@/lib/wallet/compute-meter");
  const block = await checkComputeAllowed(userId);
  if (block) throw new InsufficientCreditError(userId, block);
}

// Re-exported for callers that resolve box log paths (e.g. the logs route).
export { logFileForMcp };

const EMPTY_TOKEN: EncryptedPayload = { ciphertext: "", iv: "", tag: "" };

interface InstallRow {
  usId: string;
  bridgePort: number | null;
  configCiphertext: string;
  configIv: string;
  configTag: string;
  mcpSlug: string;
  installCmd: string;
  startCmd: string;
}

function decryptMcpConfig(row: {
  configCiphertext: string;
  configIv: string;
  configTag: string;
}): Record<string, unknown> {
  if (!row.configCiphertext) return {};
  return decryptConfig<Record<string, unknown>>({
    ciphertext: row.configCiphertext,
    iv: row.configIv,
    tag: row.configTag,
  });
}

/**
 * The env an MCP starts with: its decrypted config with every
 * `{{secret:NAME}}` resolved from the owner's vault (contract D6). Throws
 * MissingSecretError rather than ever launching with a literal placeholder.
 */
async function buildMcpConfig(
  userId: string,
  row: { configCiphertext: string; configIv: string; configTag: string }
): Promise<Record<string, unknown>> {
  const { config, missing } = await resolveSecretRefs(userId, decryptMcpConfig(row));
  if (missing.length > 0) throw new MissingSecretError(missing);
  return config;
}

/** POSIX single-quote a string for a shell command. */
function shQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Surface a missing secret where the user looks when an MCP is down: append
 * "Missing secret NAME" to the MCP's box log (the Logs tab reads it). Appends
 * rather than rewrites so a still-running bridge keeps its log. Best-effort.
 */
async function reportMissingSecrets(
  boxId: string,
  slug: string,
  err: MissingSecretError
): Promise<void> {
  const line = `${new Date().toISOString()} [twinmcp] ${err.message}. Add it in Settings > Secrets, then restart this MCP.`;
  try {
    await getBoxClient().exec(boxId, `printf '%s\n' ${shQuote(line)} >> ${logFileForMcp(slug)}`);
  } catch (e) {
    console.error(`[provision] could not write missing-secret notice for ${slug}:`, e);
  }
}

/**
 * Webhook (contract D5) for a server status transition. Fire-and-forget and
 * never throws: a webhook problem must not break provisioning. No-op when the
 * status did not change or the owner is unknown.
 */
function notifyStatusChange(
  userId: string | null | undefined,
  serverId: string,
  from: ServerStatus | null | undefined,
  to: ServerStatus
): void {
  if (!userId || from === to) return;
  try {
    emitWebhookEvent(userId, "server.status_changed", { serverId, from: from ?? null, to });
  } catch (err) {
    console.error(`[provision] status webhook failed for ${serverId}:`, err);
  }
}

/**
 * Install one MCP and bring up its HTTP bridge:
 * install → write launcher → start supergateway → expose public URL →
 * real `initialize` healthcheck. Throws (never swallows) on any failure.
 * Returns the public URL and bearer token to persist on the user_servers row.
 */
async function setupMcpBridge(
  boxId: string,
  opts: {
    slug: string;
    installCmd: string;
    startCmd: string;
    port: number;
    config: Record<string, unknown>;
  }
): Promise<{ endpointUrl: string; token: string | null }> {
  const client = getBoxClient();

  const install = await client.exec(boxId, opts.installCmd);
  if (install.status !== "completed") {
    throw new Error(`install failed for ${opts.slug}: ${install.result.slice(0, 500)}`);
  }

  const script = buildLauncherScript({
    slug: opts.slug,
    startCmd: opts.startCmd,
    port: opts.port,
    config: opts.config,
  });
  await client.writeFile(boxId, launcherPath(opts.slug), script);

  const start = await client.exec(boxId, startBridgeCommand(opts.slug));
  if (start.status !== "completed") {
    throw new Error(`bridge launch failed for ${opts.slug}: ${start.result.slice(0, 500)}`);
  }

  const endpoint = await client.exposePort(boxId, opts.port);

  const healthy = await healthcheckMcp(endpoint.url, endpoint.token);
  if (!healthy) {
    throw new Error(`MCP ${opts.slug} did not answer initialize at ${endpoint.url}`);
  }

  return { endpointUrl: endpoint.url, token: endpoint.token };
}

/** Stop a running MCP bridge (kill by PID) and tear down its public URL. */
async function stopMcpBridge(boxId: string, slug: string, port: number | null): Promise<void> {
  const client = getBoxClient();
  try {
    await client.exec(boxId, stopBridgeCommand(slug));
  } catch (err) {
    console.error(`[bridge] stop process failed for ${slug}:`, err);
  }
  if (port != null) {
    try {
      await client.unexposePort(boxId, port);
    } catch (err) {
      console.error(`[bridge] unexpose ${port} failed for ${slug}:`, err);
    }
  }
}

async function persistEndpoint(
  userServerId: string,
  port: number,
  endpointUrl: string,
  token: string | null
): Promise<void> {
  const enc = token ? encryptConfig(token) : EMPTY_TOKEN;
  await getDb()
    .update(userServers)
    .set({
      endpointUrl,
      bridgePort: port,
      endpointTokenCiphertext: enc.ciphertext,
      endpointTokenIv: enc.iv,
      endpointTokenTag: enc.tag,
    })
    .where(eq(userServers.id, userServerId));
}

/** Clear a row's bridge endpoint (after stop/disable). */
async function clearEndpoint(userServerId: string): Promise<void> {
  await getDb()
    .update(userServers)
    .set({
      endpointUrl: null,
      bridgePort: null,
      endpointTokenCiphertext: "",
      endpointTokenIv: "",
      endpointTokenTag: "",
    })
    .where(eq(userServers.id, userServerId));
}

/**
 * Atomically reserve the lowest free bridge port (>= BRIDGE_BASE_PORT) for a
 * server and write it onto the user_server row. A per-server transaction-level
 * advisory lock serializes concurrent installs so two don't grab the SAME port
 * (which would then fail to bind in the box). The lock only guards the quick
 * read+reserve, not the long box work that follows.
 */
async function reserveBridgePort(serverId: string, userServerId: string): Promise<number> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${serverId}))`);
    const existing = await tx
      .select({ p: userServers.bridgePort })
      .from(userServers)
      .where(eq(userServers.serverId, serverId));
    let port = BRIDGE_BASE_PORT;
    for (const e of existing) {
      if (e.p && e.p >= port) port = e.p + 1;
    }
    await tx.update(userServers).set({ bridgePort: port }).where(eq(userServers.id, userServerId));
    return port;
  });
}

export async function provisionServer(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!srv) {
    console.error(`[provision] server ${serverId} not found`);
    return;
  }
  if (srv.hostType === "local_agent") {
    // Local-agent servers have no box to provision — they come online when the
    // user runs `ctx7 connect`. A stray provision job (e.g. a start click) must
    // not create a box for them.
    console.warn(`[provision] server ${serverId} is local_agent — nothing to provision`);
    return;
  }

  // Last status written, for the status_changed webhook (D5).
  let current: ServerStatus = srv.status;

  // No credit, no new compute: leave the server without a runtime ("stopped"),
  // never create a box. Routes check first (assertComputeAllowed) to answer
  // 402; this is the backstop for any path that enqueues directly.
  try {
    await assertComputeAllowed(srv.userId);
  } catch (err) {
    // Fail closed: any error from the credit check also means "no box".
    const reason = isInsufficientCreditError(err) ? err.reason : "credit_check_failed";
    if (!isInsufficientCreditError(err)) {
      console.error(`[provision] credit check failed for ${serverId}:`, err);
    }
    console.warn(`[provision] server ${serverId} not provisioned: ${reason}`);
    await db
      .update(servers)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(servers.id, serverId));
    notifyStatusChange(srv.userId, serverId, current, "stopped");
    return;
  }

  try {
    await db
      .update(servers)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(servers.id, serverId));
    notifyStatusChange(srv.userId, serverId, current, "provisioning");
    current = "provisioning";

    const client = getBoxClient();

    // Warm ("always-on") boxes are a Pro+ perk, gated additionally by the
    // WARM_BOXES_ENABLED ops switch — keep-alive boxes require a paid Upstash
    // plan, so warm stays OFF (pause-when-idle for everyone) until it's on.
    // Tier from the wallet (funded or not), never users.plan.
    const warmEnabled = process.env.WARM_BOXES_ENABLED === "true";
    // A failed read falls back to pause-when-idle (the cheap, safe default).
    const owner = warmEnabled ? await getEntitlements(srv.userId).catch(() => null) : null;
    const wantWarm = keepWarm(owner?.tier ?? "free", warmEnabled);

    // Idempotent on QStash retry: reuse an existing live box rather than create a
    // duplicate. Only (re)create when there is no box or the existing one is dead.
    let boxId = srv.boxId;
    if (boxId) {
      const alive = await client.ping(boxId).catch(() => false);
      if (!alive) boxId = null;
    }
    if (!boxId) {
      const create = (keepAlive: boolean) =>
        client.createBox({
          runtime: "node", // box runs Node; MCPs run as child processes via npx
          size: srv.boxSize,
          name: `twinmcp-${srv.slug}`,
          // keepAlive:true = always warm (no cold start) but needs a paid Upstash
          // plan; keepAlive:false = pause-when-idle, woken on demand by resumeServer.
          keepAlive,
        });
      try {
        const handle = await create(wantWarm);
        boxId = handle.id;
      } catch (err) {
        // If Upstash rejects a warm box (paid plan not active yet), don't fail
        // provisioning — fall back to the free pause-when-idle model.
        const msg = err instanceof Error ? err.message : String(err);
        if (wantWarm && /paid plan/i.test(msg)) {
          console.warn(
            `[provision] warm box rejected for ${serverId} (Upstash paid plan?); using sleep-when-idle`
          );
          Sentry.captureMessage("warm-box fallback: Upstash rejected keepAlive:true", "warning");
          const handle = await create(false);
          boxId = handle.id;
        } else {
          throw err;
        }
      }
      // A zero usage snapshot (total_cost_usd 0, total_cpu_ns 0), written BEFORE
      // servers.box_id is recorded, so the meter (which attributes boxes through
      // box_id) never sees this box without it: it is billed from its first CPU
      // second. Retried, never throws; if every attempt fails, the meter still
      // bills a snapshot-less box created after metering started from zero
      // (compute-meter.ts billsFromZero). Only boxes older than metering (pre
      // 0020) are baselined at their current counters.
      const { ensureZeroSnapshot } = await import("@/lib/wallet/compute-meter");
      await ensureZeroSnapshot(boxId, serverId, srv.userId);
    }

    // Record the box id but stay in `provisioning` — we only go `running`
    // after every enabled MCP answers a real initialize.
    await db
      .update(servers)
      .set({
        boxId,
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(servers.id, serverId));

    const installations: InstallRow[] = await db
      .select({
        usId: userServers.id,
        bridgePort: userServers.bridgePort,
        configCiphertext: userServers.configCiphertext,
        configIv: userServers.configIv,
        configTag: userServers.configTag,
        mcpSlug: mcpServers.slug,
        installCmd: mcpServers.installCmd,
        startCmd: mcpServers.startCmd,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(and(eq(userServers.serverId, serverId), eq(userServers.enabled, true)));

    // Stable port assignment: reuse any already-assigned port, else next free.
    let nextPort = BRIDGE_BASE_PORT;
    for (const inst of installations) {
      if (inst.bridgePort && inst.bridgePort >= nextPort) nextPort = inst.bridgePort + 1;
    }

    // Bring up each MCP INDEPENDENTLY: one MCP with a bad install/start command
    // must not error the whole server. Failed MCPs keep a null endpoint (the
    // proxy then returns "not provisioned; restart the server"); the user can fix
    // config and restart to retry just that one.
    //
    // Assign ports up-front (deterministic), then install with BOUNDED
    // concurrency: parallel enough to cut wall-clock, capped so concurrent
    // npx/uvx installs don't thrash the box's shared npm cache. Tune with
    // PROVISION_CONCURRENCY.
    const toLaunch = installations
      .filter((inst) => inst.mcpSlug !== TWINMCP_DOCS_SLUG) // docs is control-plane served
      .map((inst) => ({ inst, port: inst.bridgePort ?? nextPort++ }));

    const launchedSlugs: string[] = [];
    const failedSlugs: string[] = [];

    const installOne = async ({ inst, port }: (typeof toLaunch)[number]): Promise<void> => {
      try {
        // Vault references resolved first: a missing secret fails this MCP
        // before anything is installed, never starts it with a placeholder.
        const config = await buildMcpConfig(srv.userId, inst);
        const { endpointUrl, token } = await setupMcpBridge(boxId, {
          slug: inst.mcpSlug,
          installCmd: inst.installCmd,
          startCmd: inst.startCmd,
          port,
          config,
        });
        await persistEndpoint(inst.usId, port, endpointUrl, token);
        launchedSlugs.push(inst.mcpSlug);
      } catch (err) {
        if (err instanceof MissingSecretError) {
          // The user's config, not a platform bug: no Sentry, a clear log line.
          console.warn(`[provision] MCP ${inst.mcpSlug} on ${serverId}: ${err.message}`);
          await reportMissingSecrets(boxId, inst.mcpSlug, err);
          failedSlugs.push(inst.mcpSlug);
          return;
        }
        console.error(`[provision] MCP ${inst.mcpSlug} failed on server ${serverId}:`, err);
        Sentry.captureException(err, {
          tags: { area: "provision", mcp: inst.mcpSlug },
          extra: { serverId },
        });
        failedSlugs.push(inst.mcpSlug);
      }
    };

    const PROVISION_CONCURRENCY = Number(process.env.PROVISION_CONCURRENCY ?? 3);
    for (let i = 0; i < toLaunch.length; i += PROVISION_CONCURRENCY) {
      await Promise.all(toLaunch.slice(i, i + PROVISION_CONCURRENCY).map(installOne));
    }

    // Write the restart script that resumeServer re-runs on wake. (Non-keep-alive
    // boxes have no initCommand, so the proxy relaunches bridges on the next
    // request via resumeServer.) Only the MCPs that actually came up.
    if (launchedSlugs.length > 0) {
      await client.writeFile(boxId, INIT_SCRIPT_PATH, buildInitScript(launchedSlugs));
    }

    if (failedSlugs.length > 0) {
      console.warn(
        `[provision] server ${serverId}: ${launchedSlugs.length} MCP(s) up, failed: ${failedSlugs.join(", ")}`
      );
    }

    // Server is usable unless EVERY box MCP failed (twinmcp-docs is always served
    // by the control plane, so it alone doesn't count as a working box runtime).
    const boxMcpCount = installations.filter((i) => i.mcpSlug !== TWINMCP_DOCS_SLUG).length;
    const allBoxMcpsFailed = boxMcpCount > 0 && launchedSlugs.length === 0;
    const finalStatus: ServerStatus = allBoxMcpsFailed ? "error" : "running";
    await db
      .update(servers)
      .set({
        status: finalStatus,
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(servers.id, serverId));
    notifyStatusChange(srv.userId, serverId, current, finalStatus);
  } catch (err) {
    console.error(`[provision] failed for server ${serverId}:`, err);
    await db
      .update(servers)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(servers.id, serverId));
    notifyStatusChange(srv.userId, serverId, current, "error");
  }
}

/**
 * "Delete runtime": destroy the server's box and everything on its disk
 * (installed packages, files the MCPs wrote, logs). The server row, its MCP
 * list and their encrypted configs are kept; status becomes `stopped` with no
 * box (lib/server-lifecycle.ts: "no runtime"), and Start provisions a fresh box.
 * Also the first half of Restart and of deleting the server.
 */
export async function destroyServerRuntime(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!srv) return;

  if (srv.boxId) {
    // Bill the box's last usage first: its counters die with it. Bounded and
    // never throws, so a metering problem cannot block the delete.
    const { meterBoxBeforeDelete } = await import("@/lib/wallet/compute-meter");
    await meterBoxBeforeDelete(srv.boxId, {
      serverId: srv.id,
      userId: srv.userId,
      size: srv.boxSize,
    });
    try {
      await getBoxClient().deleteBox(srv.boxId);
    } catch (err) {
      console.error(`[destroy] deleteBox failed for ${srv.boxId}:`, err);
      // continue — we still mark stopped to free quota
    }
  }

  await forgetRuntime(serverId, { userId: srv.userId, from: srv.status });
}

/**
 * Forget a server's runtime in the DB only — box id, endpoints and tokens —
 * WITHOUT calling the box API. For a box already gone upstream: a box that was
 * misclassified as gone must never be destroyed by a Pause.
 */
export async function forgetRuntime(
  serverId: string,
  /** Owner and status before, for the status_changed webhook (omit to skip it). */
  prev?: { userId: string | null | undefined; from: ServerStatus | null | undefined }
): Promise<void> {
  const db = getDb();
  // Clear stale per-MCP endpoints (the public URLs died with the box).
  await db
    .update(userServers)
    .set({
      endpointUrl: null,
      bridgePort: null,
      endpointTokenCiphertext: "",
      endpointTokenIv: "",
      endpointTokenTag: "",
    })
    .where(eq(userServers.serverId, serverId));

  await db
    .update(servers)
    .set({
      status: "stopped",
      boxId: null,
      endpointUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(servers.id, serverId));
  if (prev) notifyStatusChange(prev.userId, serverId, prev.from, "stopped");
}

/** The box behind a server no longer exists (reaped or deleted upstream). */
export class RuntimeGoneError extends Error {
  constructor(serverId: string) {
    super(`The runtime of server ${serverId} no longer exists`);
    this.name = "RuntimeGoneError";
  }
}

export type PauseOutcome =
  /** The box is paused: compute released, disk kept. */
  | "paused"
  /** The box refused to pause (keep-alive): its bridges and public URLs are
   *  stopped instead; the box and its disk are kept. */
  | "bridges_stopped"
  /** There was no box (or it was already gone): nothing left to pause. */
  | "no_runtime";

/**
 * "Pause" (contract K4): stop serving without losing anything. The box is
 * paused through the Upstash API, so installed packages, files and logs stay
 * on its disk. Status becomes `stopped` while the box id is KEPT — that pair
 * reads as "paused" (lib/server-lifecycle.ts). The proxy wakes it on the next
 * MCP request (resumeServer), as does the Resume button.
 */
export async function pauseServerRuntime(serverId: string): Promise<PauseOutcome> {
  const db = getDb();
  const [srv] = await db
    .select({
      boxId: servers.boxId,
      hostType: servers.hostType,
      userId: servers.userId,
      status: servers.status,
    })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (!srv) return "no_runtime";
  if (srv.hostType === "local_agent") {
    throw new Error("A local-agent server has no runtime to pause");
  }

  let outcome: PauseOutcome = "paused";
  if (!srv.boxId) {
    outcome = "no_runtime";
  } else {
    const boxId = srv.boxId;
    const client = getBoxClient();
    // A resume racing with this pause would relaunch the bridges after it.
    await resuming.get(serverId)?.catch(() => {});
    try {
      await client.pause(boxId);
    } catch (err) {
      // Decide from the status probe only, never from the pause error: an
      // unsupported or misrouted pause call can answer 404 / "not found" for a
      // box that is alive, and Pause must never cost the user their data.
      const status = await client.getStatus(boxId).catch((e: unknown) => e);
      const next = pauseFailureAction(status);
      if (next === "already_paused") {
        // Already paused by the idle lifecycle: nothing to do.
      } else if (next === "forget") {
        // Provably gone upstream: forget it in the DB, no deleteBox call.
        await forgetRuntime(serverId, { userId: srv.userId, from: srv.status });
        return "no_runtime";
      } else {
        // Keep-alive boxes cannot be paused (SDK rule): stop serving instead,
        // keeping the box and its disk. resumeServer relaunches the bridges.
        console.warn(`[pause] box ${boxId} refused to pause, stopping its bridges:`, err);
        await stopAllBridges(serverId, boxId);
        outcome = "bridges_stopped";
      }
    }
  }

  // Box id and per-MCP endpoint rows are kept: resumeServer re-exposes the
  // ports (deterministic URLs) and refreshes the tokens.
  await db
    .update(servers)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(eq(servers.id, serverId));
  notifyStatusChange(srv.userId, serverId, srv.status, "stopped");
  return outcome;
}

/** Stop every enabled MCP bridge of a server and tear down its public URLs. */
async function stopAllBridges(serverId: string, boxId: string): Promise<void> {
  const rows = await getDb()
    .select({ slug: mcpServers.slug, port: userServers.bridgePort })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(userServers.serverId, serverId), eq(userServers.enabled, true)));
  await Promise.all(
    rows
      .filter((r) => r.slug !== TWINMCP_DOCS_SLUG)
      .map((r) => stopMcpBridge(boxId, r.slug, r.port))
  );
}

/**
 * Claim the right to provision a server that has no live runtime (`stopped`
 * without a box, or `error`). Conditional, so of two concurrent Start clicks
 * only one enqueues provision-server: two jobs could both see boxId null and
 * each create (and bill) a box. The box id is kept: provisionServer reuses it
 * when it is still alive.
 */
export async function claimProvision(serverId: string): Promise<boolean> {
  const db = getDb();
  // Read first only to know the `from` of the status webhook; the conditional
  // update below stays the single source of truth for who wins.
  const [before] = await db
    .select({ userId: servers.userId, status: servers.status })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  const won = await db
    .update(servers)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(and(eq(servers.id, serverId), inArray(servers.status, ["stopped", "error"])))
    .returning({ id: servers.id });
  if (won.length === 0) return false;
  notifyStatusChange(before?.userId, serverId, before?.status, "provisioning");
  return true;
}

/**
 * The box is gone for good: forget it and claim the right to reprovision.
 * Conditional, so of many concurrent callers (a burst of proxy requests) only
 * one gets `true` and enqueues the provision job — never two new boxes.
 */
export async function claimReprovision(serverId: string): Promise<boolean> {
  const db = getDb();
  // `from` for the status webhook only (see claimProvision).
  const [before] = await db
    .select({ userId: servers.userId, status: servers.status })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  const won = await db
    .update(servers)
    .set({ status: "provisioning", boxId: null, endpointUrl: null, updatedAt: new Date() })
    .where(and(eq(servers.id, serverId), notInArray(servers.status, ["provisioning", "destroyed"])))
    .returning({ id: servers.id });
  if (won.length === 0) return false;
  notifyStatusChange(before?.userId, serverId, before?.status, "provisioning");
  await db
    .update(userServers)
    .set({
      endpointUrl: null,
      bridgePort: null,
      endpointTokenCiphertext: "",
      endpointTokenIv: "",
      endpointTokenTag: "",
    })
    .where(eq(userServers.serverId, serverId));
  return true;
}

/**
 * Install a single MCP onto an already-running server. If the server has no box
 * yet (still provisioning), the install is deferred — the next `start` re-runs
 * `provisionServer`, which reinstalls every enabled MCP.
 */
export async function installMcpInBox(userServerId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      usId: userServers.id,
      userId: userServers.userId,
      bridgePort: userServers.bridgePort,
      configCiphertext: userServers.configCiphertext,
      configIv: userServers.configIv,
      configTag: userServers.configTag,
      mcpSlug: mcpServers.slug,
      installCmd: mcpServers.installCmd,
      startCmd: mcpServers.startCmd,
      serverId: servers.id,
      serverBoxId: servers.boxId,
      serverStatus: servers.status,
    })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .innerJoin(servers, eq(servers.id, userServers.serverId))
    .where(eq(userServers.id, userServerId))
    .limit(1);

  if (!row) return;
  if (row.mcpSlug === TWINMCP_DOCS_SLUG) return; // proxy-handled
  if (row.serverStatus !== "running" || !row.serverBoxId) return; // deferred to next start

  // Missing vault secret: leave the MCP down with a clear log line. Not thrown:
  // a retry (QStash) cannot fix the user's config.
  let config: Record<string, unknown>;
  try {
    config = await buildMcpConfig(row.userId, row);
  } catch (err) {
    if (!(err instanceof MissingSecretError)) throw err;
    console.warn(`[install] MCP ${row.mcpSlug} on ${row.serverId}: ${err.message}`);
    await reportMissingSecrets(row.serverBoxId, row.mcpSlug, err);
    return;
  }

  const port = row.bridgePort ?? (await reserveBridgePort(row.serverId, row.usId));

  const { endpointUrl, token } = await setupMcpBridge(row.serverBoxId, {
    slug: row.mcpSlug,
    installCmd: row.installCmd,
    startCmd: row.startCmd,
    port,
    config,
  });
  await persistEndpoint(row.usId, port, endpointUrl, token);

  // Keep the resume init script in sync with the now-enabled set of MCPs.
  await syncInitScript(row.serverId, row.serverBoxId);
}

/**
 * Stop and tear down a single MCP bridge. The user_servers row has already been
 * deleted by the route; we only touch the box and re-sync the resume script.
 */
export async function uninstallMcpFromBox(opts: {
  boxId: string | null;
  serverId: string;
  slug: string;
  port: number | null;
}): Promise<void> {
  if (opts.slug === TWINMCP_DOCS_SLUG) return;
  if (!opts.boxId) return; // never provisioned in a box
  await stopMcpBridge(opts.boxId, opts.slug, opts.port);
  await syncInitScript(opts.serverId, opts.boxId);
}

/** Stop a disabled MCP's bridge and clear its endpoint (row kept, enabled=false). */
export async function disableMcp(userServerId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      usId: userServers.id,
      bridgePort: userServers.bridgePort,
      mcpSlug: mcpServers.slug,
      serverId: servers.id,
      serverBoxId: servers.boxId,
      serverStatus: servers.status,
    })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .innerJoin(servers, eq(servers.id, userServers.serverId))
    .where(eq(userServers.id, userServerId))
    .limit(1);

  if (!row) return;
  if (row.mcpSlug === TWINMCP_DOCS_SLUG) return;

  if (row.serverStatus === "running" && row.serverBoxId) {
    await stopMcpBridge(row.serverBoxId, row.mcpSlug, row.bridgePort);
  }
  await clearEndpoint(row.usId);
  if (row.serverBoxId) await syncInitScript(row.serverId, row.serverBoxId);
}

/** Restart a running MCP's bridge with freshly-encrypted config (new env). */
export async function reconfigureMcp(userServerId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      usId: userServers.id,
      userId: userServers.userId,
      bridgePort: userServers.bridgePort,
      configCiphertext: userServers.configCiphertext,
      configIv: userServers.configIv,
      configTag: userServers.configTag,
      mcpSlug: mcpServers.slug,
      installCmd: mcpServers.installCmd,
      startCmd: mcpServers.startCmd,
      serverId: servers.id,
      serverBoxId: servers.boxId,
      serverStatus: servers.status,
    })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .innerJoin(servers, eq(servers.id, userServers.serverId))
    .where(eq(userServers.id, userServerId))
    .limit(1);

  if (!row) return;
  if (row.mcpSlug === TWINMCP_DOCS_SLUG) return;
  if (row.serverStatus !== "running" || !row.serverBoxId) return; // deferred to next start

  // Resolve vault references BEFORE stopping the running bridge: with a
  // missing secret the old process keeps serving with its previous env and
  // the log says why the new config was not applied.
  let config: Record<string, unknown>;
  try {
    config = await buildMcpConfig(row.userId, row);
  } catch (err) {
    if (!(err instanceof MissingSecretError)) throw err;
    console.warn(`[reconfigure] MCP ${row.mcpSlug} on ${row.serverId}: ${err.message}`);
    await reportMissingSecrets(row.serverBoxId, row.mcpSlug, err);
    return;
  }

  const port = row.bridgePort ?? (await reserveBridgePort(row.serverId, row.usId));
  // Stop the old process and release its URL before relaunching on the same port.
  await stopMcpBridge(row.serverBoxId, row.mcpSlug, row.bridgePort);

  const { endpointUrl, token } = await setupMcpBridge(row.serverBoxId, {
    slug: row.mcpSlug,
    installCmd: row.installCmd,
    startCmd: row.startCmd,
    port,
    config,
  });
  await persistEndpoint(row.usId, port, endpointUrl, token);
  await syncInitScript(row.serverId, row.serverBoxId);
}

/** Rewrite the box init script from the current set of enabled, bridged MCPs. */
async function syncInitScript(serverId: string, boxId: string): Promise<void> {
  const db = getDb();
  const enabled = await db
    .select({ slug: mcpServers.slug })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(userServers.serverId, serverId), eq(userServers.enabled, true)));
  const slugs = enabled.map((e) => e.slug).filter((s) => s !== TWINMCP_DOCS_SLUG);
  const client = getBoxClient();
  // Always rewrite (even to empty) so a removed MCP is not relaunched on resume.
  await client.writeFile(boxId, INIT_SCRIPT_PATH, buildInitScript(slugs));
}

/**
 * Wake a paused (idle) box and restore its bridges + public URLs. Non-keep-alive
 * boxes release their processes AND their port exposure on pause, so: resume →
 * re-run the launcher init script → re-expose each MCP port (the URL is
 * deterministic, so it returns the same) → refresh the stored token (it may
 * rotate). Called by the proxy on the first request after an idle pause or a
 * user Pause, and by the Resume button.
 *
 * Single-flight per server (per process): a burst of requests hitting a paused
 * box shares one wake-up instead of re-running the init script N times.
 * Throws RuntimeGoneError when the box provably no longer exists, so callers
 * can reprovision instead of marking a dead box `running`.
 */
const resuming = new Map<string, Promise<void>>();

export function resumeServer(serverId: string): Promise<void> {
  const inflight = resuming.get(serverId);
  if (inflight) return inflight;
  const p = doResumeServer(serverId).finally(() => resuming.delete(serverId));
  resuming.set(serverId, p);
  return p;
}

async function doResumeServer(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db
    .select({ boxId: servers.boxId, userId: servers.userId, status: servers.status })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (!srv?.boxId) return;
  const boxId = srv.boxId;

  // Waking a box spends compute: refuse without credit (or past the promo
  // compute cap). The proxy maps this to 402 / -32008.
  await assertComputeAllowed(srv.userId);

  const client = getBoxClient();

  let resumeErr: unknown = null;
  await client.resume(boxId).catch((err: unknown) => {
    resumeErr = err;
  });
  // Like Pause: never conclude "gone" from the resume error itself (a 404 from
  // the resume endpoint is not proof) — the status probe below decides.
  if (resumeErr) console.warn(`[resume] resume call failed for ${serverId}:`, resumeErr);
  for (let i = 0; i < 20; i++) {
    let s: string;
    try {
      s = await client.getStatus(boxId);
    } catch (err) {
      if (isRuntimeGone(err)) throw new RuntimeGoneError(serverId);
      s = "unknown"; // transient: keep polling
    }
    if (isRuntimeGone(s)) throw new RuntimeGoneError(serverId);
    if (s === "running" || s === "idle") break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Processes were released on pause — relaunch every enabled bridge. Force
  // prefer-offline at the exec level so even boxes whose launchers predate that
  // flag resolve packages from the (persistent) npm cache instead of the
  // registry, keeping the wake-up to a couple of seconds.
  await client
    .exec(boxId, `export npm_config_prefer_offline=true; sh ${INIT_SCRIPT_PATH}`)
    .catch((err) => console.error(`[resume] init script failed for ${serverId}:`, err));

  // Exposure is torn down on pause — re-expose each port and refresh its token.
  const rows = await db
    .select({ usId: userServers.id, port: userServers.bridgePort, slug: mcpServers.slug })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(userServers.serverId, serverId), eq(userServers.enabled, true)));
  // Re-expose every port in parallel — independent calls, and this runs on the
  // user-facing proxy cold-start path, so the wall-clock is max, not sum.
  await Promise.all(
    rows
      .filter((r) => r.slug !== TWINMCP_DOCS_SLUG && r.port != null)
      .map(async (r) => {
        try {
          const ep = await client.exposePort(boxId, r.port!);
          await persistEndpoint(r.usId, r.port!, ep.url, ep.token);
        } catch (err) {
          console.error(`[resume] re-expose ${r.slug}:${r.port} failed:`, err);
        }
      })
  );

  await db
    .update(servers)
    .set({ status: "running", lastHeartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(servers.id, serverId));
  notifyStatusChange(srv.userId, serverId, srv.status, "running");
}
