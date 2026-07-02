/**
 * Box toolchain diagnostic — what's available inside a Node Upstash Box?
 * Determines whether we can host non-Node MCP servers (Python via uv/uvx,
 * or Docker) to broaden the catalog (github/postgres/official-fetch).
 *
 * Usage: UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-tools.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getBoxClient } from "../src/lib/upstash/box-client";

const CMDS = [
  "whoami",
  'echo "HOME=$HOME  PWD=$(pwd)"',
  "node -v",
  "npm -v",
  "npx -v",
  "python3 --version",
  "command -v uv",
  "command -v uvx",
  "command -v pipx",
  "command -v pip3",
  "command -v docker",
  "command -v go",
  "command -v curl",
  "command -v wget",
  // Can we bootstrap uv (standard runner for Python MCP servers)?
  "curl -LsSf https://astral.sh/uv/install.sh | sh 2>&1 | tail -2; ls $HOME/.local/bin/uv $HOME/.local/bin/uvx 2>/dev/null || echo '<uv install failed>'",
];

async function main() {
  const client = getBoxClient();
  let boxId: string | null = null;
  try {
    console.log("createBox (free-tier, node)…");
    const box = await client.createBox({
      runtime: "node",
      size: "small",
      name: "twinmcp-tools",
      keepAlive: false,
    });
    boxId = box.id;
    console.log(`box ${box.id}\n`);

    for (const c of CMDS) {
      const r = await client.exec(boxId, `${c} 2>&1 || echo '<absent>'`);
      console.log(`$ ${c}\n  ${r.result.trim().split("\n").join("\n  ") || "<empty>"}`);
    }
  } catch (err) {
    console.error("ERROR:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    if (boxId) {
      await client.deleteBox(boxId).catch(() => {});
      console.log("\n(box deleted)");
    }
  }
}

void main();
