/**
 * What status strings does a box report when running / paused / deleted?
 * Determines how reconcileServerHealth must distinguish "idle-but-healthy"
 * (resume-on-demand pauses are NORMAL) from "genuinely gone → error".
 *
 * Usage: UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-status.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { Box } from "@upstash/box";
import { getBoxClient } from "../src/lib/upstash/box-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function status(boxId: string): Promise<string> {
  try {
    return await getBoxClient().getStatus(boxId);
  } catch (err) {
    return `THREW: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`;
  }
}

async function main() {
  const client = getBoxClient();
  const h = await client.createBox({
    runtime: "node",
    size: "small",
    name: "twinmcp-status",
    keepAlive: false,
  });
  const boxId = h.id;
  console.log(`box ${boxId}`);
  console.log(`  fresh:   ${await status(boxId)}`);

  const box = await Box.get(boxId);
  await box.pause();
  await sleep(3000);
  console.log(`  paused:  ${await status(boxId)}`);

  await box.resume();
  await sleep(2000);
  console.log(`  resumed: ${await status(boxId)}`);

  await client.deleteBox(boxId);
  await sleep(3000);
  console.log(`  deleted: ${await status(boxId)}`);
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
