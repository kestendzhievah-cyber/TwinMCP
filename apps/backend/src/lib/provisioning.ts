import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";
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

export const TWINMCP_DOCS_SLUG = "twinmcp-docs";

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

/** Lowest free bridge port for a server (>= BRIDGE_BASE_PORT). */
async function nextFreePort(serverId: string): Promise<number> {
  const existing = await getDb()
    .select({ p: userServers.bridgePort })
    .from(userServers)
    .where(eq(userServers.serverId, serverId));
  let port = BRIDGE_BASE_PORT;
  for (const e of existing) {
    if (e.p && e.p >= port) port = e.p + 1;
  }
  return port;
}

export async function provisionServer(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!srv) {
    console.error(`[provision] server ${serverId} not found`);
    return;
  }

  try {
    await db
      .update(servers)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(servers.id, serverId));

    const client = getBoxClient();

    // Idempotent on QStash retry: reuse an existing live box rather than create a
    // duplicate. Only (re)create when there is no box or the existing one is dead.
    let boxId = srv.boxId;
    if (boxId) {
      const alive = await client.ping(boxId).catch(() => false);
      if (!alive) boxId = null;
    }
    if (!boxId) {
      const handle = await client.createBox({
        runtime: "node", // box runs Node; MCPs run as child processes via npx
        size: srv.boxSize,
        name: `twinmcp-${srv.slug}`,
        // Non-keep-alive (free tier): the box pauses when idle; the proxy wakes
        // it on demand via resumeServer. keepAlive:true would need a paid plan.
        keepAlive: false,
      });
      boxId = handle.id;
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

    const launchedSlugs: string[] = [];
    for (const inst of installations) {
      if (inst.mcpSlug === TWINMCP_DOCS_SLUG) continue; // served by the control plane
      const port = inst.bridgePort ?? nextPort++;
      const { endpointUrl, token } = await setupMcpBridge(boxId, {
        slug: inst.mcpSlug,
        installCmd: inst.installCmd,
        startCmd: inst.startCmd,
        port,
        config: decryptMcpConfig(inst),
      });
      await persistEndpoint(inst.usId, port, endpointUrl, token);
      launchedSlugs.push(inst.mcpSlug);
    }

    // Write the restart script that resumeServer re-runs on wake. (Non-keep-alive
    // boxes have no initCommand, so the proxy relaunches bridges on the next
    // request via resumeServer.)
    if (launchedSlugs.length > 0) {
      await client.writeFile(boxId, INIT_SCRIPT_PATH, buildInitScript(launchedSlugs));
    }

    await db
      .update(servers)
      .set({ status: "running", lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(eq(servers.id, serverId));
  } catch (err) {
    console.error(`[provision] failed for server ${serverId}:`, err);
    await db
      .update(servers)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(servers.id, serverId));
  }
}

export async function destroyServerRuntime(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!srv) return;

  if (srv.boxId) {
    try {
      await getBoxClient().deleteBox(srv.boxId);
    } catch (err) {
      console.error(`[destroy] deleteBox failed for ${srv.boxId}:`, err);
      // continue — we still mark stopped to free quota
    }
  }

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

  const port = row.bridgePort ?? (await nextFreePort(row.serverId));

  const { endpointUrl, token } = await setupMcpBridge(row.serverBoxId, {
    slug: row.mcpSlug,
    installCmd: row.installCmd,
    startCmd: row.startCmd,
    port,
    config: decryptMcpConfig(row),
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

  const port = row.bridgePort ?? (await nextFreePort(row.serverId));
  // Stop the old process and release its URL before relaunching on the same port.
  await stopMcpBridge(row.serverBoxId, row.mcpSlug, row.bridgePort);

  const { endpointUrl, token } = await setupMcpBridge(row.serverBoxId, {
    slug: row.mcpSlug,
    installCmd: row.installCmd,
    startCmd: row.startCmd,
    port,
    config: decryptMcpConfig(row),
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
 * rotate). Called by the proxy on the first request after an idle pause.
 */
export async function resumeServer(serverId: string): Promise<void> {
  const db = getDb();
  const [srv] = await db
    .select({ boxId: servers.boxId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (!srv?.boxId) return;
  const boxId = srv.boxId;
  const client = getBoxClient();

  await client.resume(boxId).catch(() => {});
  for (let i = 0; i < 20; i++) {
    const s = await client.getStatus(boxId).catch(() => "unknown");
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
  for (const r of rows) {
    if (r.slug === TWINMCP_DOCS_SLUG || r.port == null) continue;
    try {
      const ep = await client.exposePort(boxId, r.port);
      await persistEndpoint(r.usId, r.port, ep.url, ep.token);
    } catch (err) {
      console.error(`[resume] re-expose ${r.slug}:${r.port} failed:`, err);
    }
  }

  await db
    .update(servers)
    .set({ status: "running", lastHeartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(servers.id, serverId));
}
