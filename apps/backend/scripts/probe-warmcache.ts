/**
 * Warm-cache viability probe — the decisive experiment for fixing cold-start.
 *
 * Question: on a free-tier (keepAlive:false) box that PAUSES when idle, does the
 * filesystem — and specifically an npm package cache placed under the writable
 * /workspace/home — SURVIVE a pause→resume? If yes, we can pre-warm the cache at
 * provision time so resume only re-spawns processes (fast) instead of
 * re-downloading packages (30–90s). If no, only keepAlive:true (paid) fixes it.
 *
 * It also times an offline re-install after resume to prove a cache hit.
 *
 * Usage:
 *   UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-warmcache.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { Box } from "@upstash/box";
import { getBoxClient } from "../src/lib/upstash/box-client";

const CACHE = "/workspace/home/.npm-cache";
const PKG = "cowsay@1.5.0"; // small, pinned, clean-exiting — representative enough for a cache test
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
      name: "twinmcp-warmcache",
      keepAlive: false,
    });
    boxId = h.id;
    console.log(`   box ${boxId}`);

    // Marker file to test raw FS persistence, independent of the npm cache.
    await client.exec(boxId, "echo persisted > /workspace/home/marker.txt");

    console.log(`2. warm the persistent npm cache (npx ${PKG}, downloads)…`);
    const t0 = Date.now();
    const warm = await client.exec(
      boxId,
      `export npm_config_cache=${CACHE}; npx -y ${PKG} "warm" >/dev/null 2>&1; echo done`
    );
    console.log(`   status=${warm.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const before = await client.exec(
      boxId,
      `du -sh ${CACHE} 2>/dev/null | cut -f1; echo "files:"; find ${CACHE} -type f 2>/dev/null | wc -l`
    );
    console.log(`   cache before pause: ${before.result.trim().replace(/\n/g, " ")}`);

    const box = await Box.get(boxId);
    console.log("3. pause…");
    await box.pause();
    console.log(`   status=${await waitStatus(box, ["paused"], 20)}`);

    console.log("4. resume…");
    const r0 = Date.now();
    await box.resume();
    const st = await waitStatus(box, ["running", "idle"], 40);
    console.log(`   status=${st} in ${((Date.now() - r0) / 1000).toFixed(1)}s`);

    console.log("5. check persistence after resume…");
    const marker = await client.exec(
      boxId,
      "cat /workspace/home/marker.txt 2>/dev/null || echo MISSING"
    );
    const after = await client.exec(
      boxId,
      `du -sh ${CACHE} 2>/dev/null | cut -f1; echo "files:"; find ${CACHE} -type f 2>/dev/null | wc -l`
    );
    console.log(`   marker: ${marker.result.trim()}`);
    console.log(`   cache after resume: ${after.result.trim().replace(/\n/g, " ")}`);

    console.log("6. offline re-install after resume (proves a cache hit)…");
    const t1 = Date.now();
    const off = await client.exec(
      boxId,
      `export npm_config_cache=${CACHE} npm_config_offline=true; npx -y ${PKG} "cachehit" 2>&1 | tail -3; echo "EXIT_OK"`
    );
    const offlineSecs = ((Date.now() - t1) / 1000).toFixed(1);
    const offlineWorked =
      off.result.includes("EXIT_OK") && !/network|ENOTFOUND|offline mode/i.test(off.result);
    console.log(`   offline run ${offlineWorked ? "✅ worked" : "❌ failed"} in ${offlineSecs}s`);
    console.log(`   out: ${off.result.trim().slice(0, 240).replace(/\n/g, " ⏎ ")}`);

    const fsPersists = marker.result.includes("persisted");
    const cachePersists = !after.result.includes("MISSING") && !/files:\s*0/.test(after.result);

    console.log("\n=== VERDICT ===");
    console.log(`FS (/workspace/home) persists across pause:  ${fsPersists ? "YES" : "NO"}`);
    console.log(`npm cache under /workspace/home persists:    ${cachePersists ? "YES" : "NO"}`);
    console.log(`offline re-install works after resume:       ${offlineWorked ? "YES" : "NO"}`);
    console.log(
      fsPersists && cachePersists && offlineWorked
        ? "\n➡️  WARM CACHE IS VIABLE: pre-warm the cache at provision, resume becomes process-restart only."
        : "\n➡️  Warm cache NOT viable on free tier — cold-start needs keepAlive:true (paid) or a persistent volume."
    );
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
