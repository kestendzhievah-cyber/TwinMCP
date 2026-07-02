/**
 * Direct Upstash Box runtime probe — verifies the real box-client + mcp-bridge
 * WITHOUT a full deploy. Creates a box, installs the `filesystem` MCP, starts
 * the supergateway bridge, exposes a public URL, and does a real `initialize`.
 * Deletes the box at the end.
 *
 * Usage:
 *   UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-box.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getBoxClient } from "../src/lib/upstash/box-client";
import {
  buildLauncherScript,
  launcherPath,
  logFileForMcp,
  startBridgeCommand,
  healthcheckMcp,
} from "../src/lib/upstash/mcp-bridge";

const PORT = 8080;
const SLUG = "filesystem";
// Override to probe any MCP, e.g. a Python server via uv:
//   PROBE_INSTALL='curl -LsSf https://astral.sh/uv/install.sh | sh' PROBE_START='uvx mcp-server-fetch'
const START =
  process.env.PROBE_START ??
  "npx -y @modelcontextprotocol/server-filesystem@2026.1.14 /workspace/home";
const INSTALL = process.env.PROBE_INSTALL ?? "";

async function main() {
  if (!process.env.UPSTASH_BOX_API_KEY) {
    console.error("Set UPSTASH_BOX_API_KEY");
    process.exit(1);
  }
  const client = getBoxClient();
  let boxId: string | null = null;

  try {
    // Default true = the real production model (needs a paid Upstash plan).
    // Set PROBE_KEEP_ALIVE=false to probe on the free tier (non-persistent box).
    const keepAlive = process.env.PROBE_KEEP_ALIVE !== "false";
    console.log(`1. createBox (node, small, keepAlive=${keepAlive})…`);
    const box = await client.createBox({
      runtime: "node",
      size: "small",
      name: "twinmcp-probe",
      keepAlive,
    });
    boxId = box.id;
    console.log(`   ✓ box ${box.id}`);

    if (INSTALL) {
      console.log(`2. install step: ${INSTALL.slice(0, 70)}…`);
      const inst = await client.exec(boxId, INSTALL);
      console.log(`   status=${inst.status}`);
      if (inst.status !== "completed") {
        console.log(inst.result.slice(0, 800));
        throw new Error("install step failed");
      }
    }

    console.log(`3. write launcher + start supergateway…\n   startCmd: ${START}`);
    const script = buildLauncherScript({ slug: SLUG, startCmd: START, port: PORT, config: {} });
    await client.writeFile(boxId, launcherPath(SLUG), script);
    const start = await client.exec(boxId, startBridgeCommand(SLUG));
    console.log(`   start status=${start.status}`);

    console.log("4. expose public URL…");
    const ep = await client.exposePort(boxId, PORT);
    console.log(`   ✓ ${ep.url}  token=${ep.token ? "set" : "none"}`);

    console.log("5. healthcheck — real MCP initialize (up to ~60s)…");
    const ok = await healthcheckMcp(ep.url, ep.token, { attempts: 20, delayMs: 3000 });

    if (!ok) {
      console.log("   ❌ no initialize response — bridge log:");
      const log = await client.tail(boxId, logFileForMcp(SLUG), 80).catch(() => "(no log)");
      console.log("--- log ---\n" + log + "\n-----------");
    }

    console.log(
      ok
        ? "\n✅ BOX RUNTIME PROVEN — createBox → install → bridge → public URL → initialize all work."
        : "\n❌ BOX RUNTIME FAILED at the bridge/healthcheck step (see log above)."
    );
    if (!ok) process.exitCode = 1;
  } catch (err) {
    console.error("\n❌ ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  } finally {
    if (boxId) {
      console.log("\n6. cleanup: delete box…");
      await client.deleteBox(boxId).catch((e) => console.error("   delete failed:", e));
      console.log("   ✓ deleted");
    }
  }
}

void main();
