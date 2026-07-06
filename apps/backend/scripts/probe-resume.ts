/**
 * Pause/resume lifecycle probe — R&D for Option B (resume-on-demand, no paid plan).
 * Non-keep-alive boxes have NO initCommand, so the proxy must manually restart the
 * bridge on resume. This measures: does the public URL survive pause? does a manual
 * bridge restart bring it back? resume + warm latency?
 *
 * Usage: UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-resume.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { Box } from "@upstash/box";
import { getBoxClient } from "../src/lib/upstash/box-client";
import {
  buildLauncherScript,
  healthcheckMcp,
  launcherPath,
  startBridgeCommand,
} from "../src/lib/upstash/mcp-bridge";

const SLUG = "filesystem";
const PORT = 8080;
const START = "npx -y @modelcontextprotocol/server-filesystem@2026.1.14 /workspace/home";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitStatus(box: Box, want: string[], max = 40): Promise<string> {
  for (let i = 0; i < max; i++) {
    const s = (await box.getStatus()).status;
    if (want.includes(s)) return s;
    await sleep(2000);
  }
  return "(timeout)";
}

async function main() {
  const client = getBoxClient();
  let boxId: string | null = null;
  try {
    console.log("1. create non-keep-alive box + bridge…");
    const h = await client.createBox({
      runtime: "node",
      size: "small",
      name: "twinmcp-resume",
      keepAlive: false,
    });
    boxId = h.id;
    await client.writeFile(
      boxId,
      launcherPath(SLUG),
      buildLauncherScript({ slug: SLUG, startCmd: START, port: PORT, config: {} })
    );
    await client.exec(boxId, startBridgeCommand(SLUG));
    const ep = await client.exposePort(boxId, PORT);
    console.log(`   box ${boxId}  url ${ep.url}`);
    console.log(`   initialize before pause: ${(await healthcheckMcp(ep.url, ep.token)) ? "✅" : "❌"}`);

    const box = await Box.get(boxId);

    console.log("2. pause…");
    await box.pause();
    console.log(`   status=${await waitStatus(box, ["paused"], 20)}`);

    console.log("3. resume…");
    const t0 = Date.now();
    await box.resume();
    const st = await waitStatus(box, ["running", "idle"], 40);
    const resumeS = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`   status=${st} after ${resumeS}s`);

    console.log("4. same URL after resume, no restart (does the bridge survive?)…");
    const survived = await healthcheckMcp(ep.url, ep.token, { attempts: 2, delayMs: 2000 });
    console.log(`   ${survived ? "✅ bridge survived resume" : "❌ bridge dead (expected — must restart)"}`);

    let workingUrl = ep.url;
    let workingToken = ep.token;
    if (!survived) {
      console.log("5. manual restart: re-run the launcher, same URL…");
      const w0 = Date.now();
      await client.exec(boxId, startBridgeCommand(SLUG));
      const back = await healthcheckMcp(ep.url, ep.token, { attempts: 30, delayMs: 3000 });
      console.log(
        `   ${back ? "✅ same URL works" : "❌ URL lost on pause"} (warm ${((Date.now() - w0) / 1000).toFixed(1)}s)`
      );
      if (!back) {
        console.log("6. re-expose port (URL may have changed)…");
        const ep2 = await client.exposePort(boxId, PORT);
        console.log(`   new url ${ep2.url} (same as before: ${ep2.url === ep.url})`);
        const back2 = await healthcheckMcp(ep2.url, ep2.token, { attempts: 20, delayMs: 3000 });
        console.log(`   ${back2 ? "✅ works after re-expose" : "❌ still down"}`);
        workingUrl = ep2.url;
        workingToken = ep2.token;
      }
    }

    console.log("\n=== VERDICT ===");
    console.log(`resume latency: ~${resumeS}s`);
    console.log(`bridge survives resume: ${survived ? "yes" : "no (manual restart needed)"}`);
    console.log(`working URL after full cycle: ${workingUrl === ep.url ? "same as original" : "CHANGED"}`);
    console.log(`final reachable: ${(await healthcheckMcp(workingUrl, workingToken, { attempts: 2, delayMs: 2000 })) ? "✅" : "❌"}`);
  } catch (err) {
    console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  } finally {
    if (boxId) {
      await client.deleteBox(boxId).catch(() => {});
      console.log("(box deleted)");
    }
  }
}

void main();
