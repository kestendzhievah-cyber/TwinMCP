import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";
import { decryptConfig } from "@/lib/crypto/config-encryption";

export const TWINMCP_DOCS_SLUG = "twinmcp-docs";

export function logFileForMcp(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "_");
  return `/tmp/mcp-${safe}.log`;
}

function buildEnvPrefix(config: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(config)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) continue; // skip non-env-safe keys
    const escaped = String(v).replace(/'/g, "'\\''");
    parts.push(`${k}='${escaped}'`);
  }
  return parts.length ? `export ${parts.join(" ")} && ` : "";
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
    const handle = await client.createBox({
      runtime: "node", // box runs Node — MCPs run as child processes via npx
      size: srv.boxSize,
      name: `twinmcp-${srv.slug}`,
    });

    await db
      .update(servers)
      .set({
        boxId: handle.id,
        endpointUrl: handle.endpointUrl,
        status: "running",
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(servers.id, serverId));

    // Install all enabled MCPs (skip twinmcp-docs — handled by control plane proxy)
    const installations = await db
      .select({
        usId: userServers.id,
        usConfigCiphertext: userServers.configCiphertext,
        usConfigIv: userServers.configIv,
        usConfigTag: userServers.configTag,
        mcpSlug: mcpServers.slug,
        mcpInstallCmd: mcpServers.installCmd,
        mcpStartCmd: mcpServers.startCmd,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(and(eq(userServers.serverId, serverId), eq(userServers.enabled, true)));

    for (const inst of installations) {
      if (inst.mcpSlug === TWINMCP_DOCS_SLUG) continue;
      try {
        await runInstallation(handle.id, {
          slug: inst.mcpSlug,
          installCmd: inst.mcpInstallCmd,
          startCmd: inst.mcpStartCmd,
          configCiphertext: inst.usConfigCiphertext,
          configIv: inst.usConfigIv,
          configTag: inst.usConfigTag,
        });
      } catch (err) {
        console.error(`[provision] failed to install ${inst.mcpSlug} on ${serverId}:`, err);
      }
    }
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

interface RunInstallationOpts {
  slug: string;
  installCmd: string;
  startCmd: string;
  configCiphertext: string;
  configIv: string;
  configTag: string;
}

async function runInstallation(boxId: string, opts: RunInstallationOpts): Promise<void> {
  const client = getBoxClient();
  let config: Record<string, unknown> = {};
  if (opts.configCiphertext) {
    config = decryptConfig<Record<string, unknown>>({
      ciphertext: opts.configCiphertext,
      iv: opts.configIv,
      tag: opts.configTag,
    });
  }

  const installResult = await client.exec(boxId, opts.installCmd);
  if (installResult.status !== "completed") {
    throw new Error(`install failed: ${installResult.result.slice(0, 500)}`);
  }

  const envPrefix = buildEnvPrefix(config);
  await client.execBackground(boxId, `${envPrefix}${opts.startCmd}`, logFileForMcp(opts.slug));
}

export async function installMcpInBox(userServerId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      usConfigCiphertext: userServers.configCiphertext,
      usConfigIv: userServers.configIv,
      usConfigTag: userServers.configTag,
      mcpSlug: mcpServers.slug,
      mcpInstallCmd: mcpServers.installCmd,
      mcpStartCmd: mcpServers.startCmd,
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

  await runInstallation(row.serverBoxId, {
    slug: row.mcpSlug,
    installCmd: row.mcpInstallCmd,
    startCmd: row.mcpStartCmd,
    configCiphertext: row.usConfigCiphertext,
    configIv: row.usConfigIv,
    configTag: row.usConfigTag,
  });
}
