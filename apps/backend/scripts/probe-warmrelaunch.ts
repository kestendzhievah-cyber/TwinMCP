/**
 * Cold-vs-warm relaunch probe (the real fix measurement).
 *
 * The persistence probe showed /workspace/home and the npm cache survive a
 * pause. So resume should only be slow because the launcher re-resolves packages
 * over the network. This measures, with the REAL bridge (supergateway +
 * filesystem MCP):
 *   - COLD: provision from a fresh box → time to a healthy `initialize`
 *   - WARM: after pause→resume, relaunch the same bridge → time to healthy
 * with `npm_config_prefer_offline=true` so the warm relaunch uses the cache.
 *
 * A big cold→warm drop = warm cache is the cold-start fix (no paid keepAlive).
 *
 * Usage:
 *   UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-warmrelaunch.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { Box } from "@upstash/box";
import { getBoxClient } from "../src/lib/upstash/box-client";
import {
  MCP_STREAM_PATH,
  launcherPath,
  logFileForMcp,
  pidPath,
  healthcheckMcp,
} from "../src/lib/upstash/mcp-bridge";

const SLUG = "filesystem";
const PORT = 8080;
const START = "npx -y @modelcontextprotocol/server-filesystem@2026.1.14 /workspace/home";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Launcher with prefer-offline + pinned supergateway so a warm relaunch hits
 *  the persistent cache instead of the registry. */
function launcher(): string {
  return [
    "#!/bin/sh",
    "set -e",
    'export PATH="$HOME/.local/bin:$PATH"',
    // Use the cache (which survives pause) before the network on every npm/npx.
    "export npm_config_prefer_offline=true",
    `echo $$ > ${pidPath(SLUG)}`,
    `exec npx -y supergateway@3.4.3 \\`,
    `  --stdio "${START.replace(/"/g, '\\"')}" \\`,
    `  --outputTransport streamableHttp \\`,
    `  --streamableHttpPath ${MCP_STREAM_PATH} \\`,
    `  --port ${PORT} \\`,
    `  --healthEndpoint /healthz \\`,
    `  --cors`,
    "",
  ].join("\n");
}

const startCmd = `nohup sh ${launcherPath(SLUG)} < /dev/null > ${logFileForMcp(SLUG)} 2>&1 &`;

async function waitStatus(box: Box, want: string[], max = 40): Promise<string> {
  for (let i = 0; i < max; i++) {
    const s = (await box.getStatus()).status;
    if (want.includes(s)) return s;
    await sleep(2000);
  }
  return "(timeout)";
}

/** Time (s) until the bridge answers a real MCP initialize, or -1 on timeout. */
async function timeToHealthy(url: string, token: string | null, attempts: number): Promise<number> {
  const t0 = Date.now();
  const ok = await healthcheckMcp(url, token, { attempts, delayMs: 1500 });
  return ok ? (Date.now() - t0) / 1000 : -1;
}

async function main() {
  if (!process.env.UPSTASH_BOX_API_KEY) {
    console.error("Set UPSTASH_BOX_API_KEY");
    process.exit(1);
  }
  const client = getBoxClient();
  let boxId: string | null = null;

  try {
    console.log("1. create non-keep-alive box…");
    const h = await client.createBox({
      runtime: "node",
      size: "small",
      name: "twinmcp-warmrelaunch",
      keepAlive: false,
    });
    boxId = h.id;
    console.log(`   box ${boxId}`);

    await client.writeFile(boxId, launcherPath(SLUG), launcher());

    console.log("2. COLD: start bridge, time to healthy…");
    await client.exec(boxId, startCmd);
    const ep = await client.exposePort(boxId, PORT);
    const cold = await timeToHealthy(ep.url, ep.token, 40);
    console.log(`   cold: ${cold < 0 ? "TIMEOUT" : cold.toFixed(1) + "s"}  (${ep.url})`);

    const box = await Box.get(boxId);
    console.log("3. pause…");
    await box.pause();
    console.log(`   ${await waitStatus(box, ["paused"], 20)}`);

    console.log("4. resume…");
    const r0 = Date.now();
    await box.resume();
    console.log(
      `   ${await waitStatus(box, ["running", "idle"], 40)} in ${((Date.now() - r0) / 1000).toFixed(1)}s`
    );

    console.log("5. WARM: kill any survivor, relaunch bridge, time to healthy…");
    await client.exec(boxId, `kill "$(cat ${pidPath(SLUG)} 2>/dev/null)" 2>/dev/null; true`);
    const ep2 = await client.exposePort(boxId, PORT);
    const w0 = Date.now();
    await client.exec(boxId, startCmd);
    const warm = await timeToHealthy(ep2.url, ep2.token, 40);
    const warmWall = ((Date.now() - w0) / 1000).toFixed(1);
    console.log(
      `   warm: ${warm < 0 ? "TIMEOUT" : warm.toFixed(1) + "s"}  (relaunch+health ${warmWall}s, url same: ${ep2.url === ep.url})`
    );

    console.log("\n=== VERDICT ===");
    console.log(`cold time-to-healthy: ${cold < 0 ? "TIMEOUT" : cold.toFixed(1) + "s"}`);
    console.log(`warm time-to-healthy: ${warm < 0 ? "TIMEOUT" : warm.toFixed(1) + "s"}`);
    if (cold > 0 && warm > 0) {
      const speedup = (cold / warm).toFixed(1);
      console.log(
        warm <= 15
          ? `➡️  WARM RELAUNCH IS FAST (${warm.toFixed(1)}s, ${speedup}× faster). prefer-offline + persistent cache fixes cold-start on the free tier.`
          : `➡️  Warm still slow (${warm.toFixed(1)}s) — cache not helping enough; consider global preinstall or keepAlive.`
      );
    }
  } catch (err) {
    console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  } finally {
    if (boxId) {
      await client.deleteBox(boxId).catch(() => {});
      console.log("\n(box deleted)");
    }
  }
}

void main();
