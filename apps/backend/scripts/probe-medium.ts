/**
 * Does the Upstash account allow a Medium box? Creates one (keepAlive:false),
 * prints success/error, deletes it. Diagnoses a server stuck in `error` with
 * box_size=medium and no box_id (createBox never succeeded).
 *
 * Usage: UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-medium.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getBoxClient } from "../src/lib/upstash/box-client";

async function tryCreate(size: "small" | "medium") {
  const client = getBoxClient();
  console.log(`\n→ createBox(size=${size}, keepAlive=false)…`);
  try {
    const box = await client.createBox({ runtime: "node", size, name: `twinmcp-probe-${size}`, keepAlive: false });
    console.log(`   ✅ created ${box.id}`);
    await client.deleteBox(box.id).catch(() => {});
    console.log(`   (deleted)`);
  } catch (err) {
    console.log(`   ❌ ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  if (!process.env.UPSTASH_BOX_API_KEY) {
    console.error("Set UPSTASH_BOX_API_KEY");
    process.exit(1);
  }
  await tryCreate("small");
  await tryCreate("medium");
}

void main();
