/**
 * Multi-MCP end-to-end proof. Provisions ONE real Upstash Box, then publishes
 * several real MCP servers onto it (filesystem, memory, sequential-thinking,
 * fetch) exactly the way production does — supergateway bridge → bearer-protected
 * public URL — and drives each one through the full MCP handshake:
 *
 *     initialize → notifications/initialized → tools/list → tools/call
 *
 * Prints a pass/fail table and deletes the box at the end. This is the "does the
 * whole runtime actually work" check, across multiple MCPs at once.
 *
 * Usage:
 *   UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/probe-mcps.ts
 *   # optional: PROBE_KEEP_ALIVE=false (free tier), PROBE_ONLY=filesystem,memory
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getBoxClient } from "../src/lib/upstash/box-client";
import {
  BRIDGE_BASE_PORT,
  MCP_STREAM_PATH,
  buildLauncherScript,
  launcherPath,
  logFileForMcp,
  startBridgeCommand,
  stopBridgeCommand,
} from "../src/lib/upstash/mcp-bridge";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The MCPs to publish, mirroring scripts/seed-mcps.ts. `call` = a safe, no-arg-ish
 *  tool to actually invoke to prove the server executes (null = tools/list only). */
interface ProbeMcp {
  slug: string;
  install: string; // shell run once before the bridge starts ("" = none)
  start: string; // stdio command supergateway wraps
  call: { name: string; args: Record<string, unknown> } | null;
}

const ALL_MCPS: ProbeMcp[] = [
  {
    slug: "filesystem",
    install: "",
    start: "npx -y @modelcontextprotocol/server-filesystem@2026.1.14 /workspace/home",
    call: { name: "list_allowed_directories", args: {} },
  },
  {
    slug: "memory",
    install: "",
    start: "npx -y @modelcontextprotocol/server-memory@2026.1.26",
    call: { name: "read_graph", args: {} },
  },
  {
    slug: "sequential-thinking",
    install: "",
    start: "npx -y @modelcontextprotocol/server-sequential-thinking@2025.12.18",
    call: null, // its only tool needs a rich thought payload — list is enough proof
  },
  {
    slug: "everything",
    install: "",
    start: "npx -y @modelcontextprotocol/server-everything@2026.7.4",
    call: { name: "echo", args: { message: "twinmcp" } },
  },
  {
    slug: "fetch",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx mcp-server-fetch",
    call: { name: "fetch", args: { url: "https://example.com" } },
  },
  {
    slug: "time",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx mcp-server-time",
    call: { name: "get_current_time", args: { timezone: "UTC" } },
  },
  {
    slug: "git",
    install:
      "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh; " +
      "git --version && mkdir -p /workspace/home/gitrepo && cd /workspace/home/gitrepo && " +
      "git init -q && git config user.email probe@twinmcp && git config user.name probe && " +
      "echo hello > README.md && git add -A && git commit -q -m init",
    start: "uvx mcp-server-git --repository /workspace/home/gitrepo",
    call: { name: "git_status", args: { repo_path: "/workspace/home/gitrepo" } },
  },
  // ---- candidates for the marketplace expansion (prove before publishing) ----
  {
    slug: "sqlite",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx mcp-server-sqlite --db-path ${SQLITE_DB_PATH:-/workspace/home/twinmcp.db}",
    call: { name: "list_tables", args: {} },
  },
  {
    slug: "duckduckgo",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx duckduckgo-mcp-server",
    call: { name: "search", args: { query: "model context protocol", max_results: 3 } },
  },
  {
    slug: "wikipedia",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx wikipedia-mcp",
    call: { name: "search_wikipedia", args: { query: "Model Context Protocol", limit: 3 } },
  },
  {
    slug: "markitdown",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx markitdown-mcp",
    call: { name: "convert_to_markdown", args: { uri: "https://example.com" } },
  },
  {
    slug: "calculator",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx mcp-server-calculator",
    call: { name: "calculate", args: { expression: "6 * 7" } },
  },
  // ---- round 2: proven marketplace additions (exact published commands) ----
  {
    slug: "shell",
    install: "",
    start: "npx -y mcp-server-commands@0.8.2",
    call: { name: "run_process", args: { command_line: "echo twinmcp" } },
  },
  {
    slug: "duckdb",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx mcp-server-duckdb --db-path ${DUCKDB_DB_PATH:-/workspace/home/twin.duckdb}",
    call: { name: "query", args: { query: "SELECT 42 AS answer" } },
  },
  {
    slug: "arxiv",
    install: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    start: "uvx arxiv-mcp-server --storage-path ${ARXIV_STORAGE_PATH:-/workspace/home/arxiv}",
    call: { name: "search_papers", args: { query: "large language models", max_results: 3 } },
  },
  {
    slug: "youtube",
    install: "",
    start: "npx -y @sinco-lab/mcp-youtube-transcript@0.0.12",
    call: { name: "get_transcript", args: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
  },
  {
    slug: "chart",
    install: "",
    start: "npx -y @antv/mcp-server-chart@0.9.10",
    call: {
      name: "generate_line_chart",
      args: {
        data: [
          { time: "2020", value: 10 },
          { time: "2021", value: 25 },
          { time: "2022", value: 18 },
        ],
      },
    },
  },
];

type JsonRpc = { id?: unknown; result?: Record<string, unknown>; error?: unknown };

/** Parse a Streamable-HTTP response body: either raw JSON or SSE (`data: {...}`). */
function parseBody(text: string): JsonRpc | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice("data:".length).trim());
  const candidates = dataLines.length ? dataLines : [trimmed];
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as JsonRpc;
      if (obj && (obj.result !== undefined || obj.error !== undefined || obj.id !== undefined)) {
        return obj;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** A stateful MCP client over Streamable HTTP: carries the session id + bearer. */
class McpClient {
  private sessionId: string | null = null;
  private id = 0;
  constructor(
    private readonly url: string,
    private readonly token: string | null
  ) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
    };
  }

  async request(
    method: string,
    params: Record<string, unknown> = {},
    attempts = 3
  ): Promise<JsonRpc> {
    let lastErr: unknown;
    // Streamable-HTTP bridges occasionally answer a warm request with an empty
    // body (SSE keep-alive raced the reply). Retry a few times before failing.
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
        });
        const sid = res.headers.get("mcp-session-id");
        if (sid) this.sessionId = sid;
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
        const parsed = parseBody(text);
        if (!parsed) throw new Error(`empty/unparseable response`);
        if (parsed.error) {
          throw new Error(`rpc error: ${JSON.stringify(parsed.error).slice(0, 160)}`);
        }
        return parsed;
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await sleep(800);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("request failed");
  }

  async notify(method: string, params: Record<string, unknown> = {}): Promise<void> {
    await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method, params }),
    }).catch(() => {});
  }

  /** initialize, retrying while the bridge cold-starts (npx download). */
  async initialize(attempts: number, delayMs: number): Promise<Record<string, unknown>> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const r = await this.request(
          "initialize",
          {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "twinmcp-probe", version: "1.0.0" },
          },
          1 // one shot — the outer loop already retries during cold start
        );
        if (r.result && (r.result.serverInfo || r.result.capabilities)) {
          await this.notify("notifications/initialized");
          return r.result;
        }
      } catch (e) {
        lastErr = e;
      }
      if (i < attempts - 1) await sleep(delayMs);
    }
    throw new Error(
      `initialize never succeeded: ${lastErr instanceof Error ? lastErr.message : ""}`
    );
  }
}

interface Row {
  slug: string;
  init: boolean;
  server: string;
  tools: number;
  sample: string;
  call: string;
  note: string;
}

async function main() {
  if (!process.env.UPSTASH_BOX_API_KEY) {
    console.error("Set UPSTASH_BOX_API_KEY");
    process.exit(1);
  }

  const only = (process.env.PROBE_ONLY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mcps = only.length ? ALL_MCPS.filter((m) => only.includes(m.slug)) : ALL_MCPS;

  const client = getBoxClient();
  const keepAlive = process.env.PROBE_KEEP_ALIVE !== "false";
  let boxId: string | null = null;
  const rows: Row[] = [];

  try {
    console.log(`1. createBox (node, small, keepAlive=${keepAlive})…`);
    const box = await client.createBox({
      runtime: "node",
      size: "small",
      name: "twinmcp-probe-mcps",
      keepAlive,
    });
    boxId = box.id;
    console.log(`   ✓ box ${box.id}`);

    // Ports are deterministic per MCP. Process each one FULLY (install → bridge →
    // expose → handshake) before starting the next, so only ONE cold start
    // (npx/uvx build) runs at a time. This mirrors production — MCPs install
    // one-by-one per box — and avoids a fork/OOM storm on a small box from many
    // simultaneous heavy cold builds (which can make a uvx server exit 127).
    const ports = new Map<string, number>();
    mcps.forEach((m, i) => ports.set(m.slug, BRIDGE_BASE_PORT + i));
    const ranInstalls = new Set<string>();

    for (const m of mcps) {
      const port = ports.get(m.slug)!;

      // 2. install step (deduped — e.g. the shared uv bootstrap)
      if (m.install && !ranInstalls.has(m.install)) {
        console.log(`2. install: ${m.install.slice(0, 66)}…`);
        const r = await client.exec(boxId, m.install);
        console.log(`   status=${r.status}`);
        ranInstalls.add(m.install);
      }

      // 3. write launcher + start the bridge
      console.log(`3. [${m.slug}] launcher on :${port} → ${m.start.slice(0, 60)}`);
      const script = buildLauncherScript({ slug: m.slug, startCmd: m.start, port, config: {} });
      await client.writeFile(boxId, launcherPath(m.slug), script);
      await client.exec(boxId, startBridgeCommand(m.slug));

      // 4. expose the port to a public bearer URL
      const ep = await client.exposePort(boxId, port);
      console.log(`4. [${m.slug}] ${ep.url}  token=${ep.token ? "set" : "none"}`);

      // 5. drive this MCP through the full handshake before moving on
      const target = ep.url.replace(/\/$/, "") + MCP_STREAM_PATH;
      const mcp = new McpClient(target, ep.token);
      const row: Row = {
        slug: m.slug,
        init: false,
        server: "—",
        tools: 0,
        sample: "—",
        call: m.call ? "…" : "n/a",
        note: "",
      };
      console.log(`5. [${m.slug}] initialize (up to ~90s cold start)…`);
      try {
        const info = await mcp.initialize(30, 3000);
        row.init = true;
        const si = info.serverInfo as { name?: string; version?: string } | undefined;
        row.server = si?.name ? `${si.name}@${si.version ?? "?"}` : "ok";

        const list = await mcp.request("tools/list");
        const tools = (list.result?.tools ?? []) as Array<{ name: string }>;
        row.tools = tools.length;
        row.sample =
          tools
            .slice(0, 3)
            .map((t) => t.name)
            .join(", ") || "—";
        console.log(`   ✓ initialized · ${tools.length} tools`);
        if (process.env.PROBE_DEBUG === "1") {
          console.log(`   --- ${m.slug} tool schemas ---`);
          console.log(JSON.stringify(tools, null, 1).slice(0, 1600));
        }

        if (m.call) {
          try {
            const res = await mcp.request("tools/call", {
              name: m.call.name,
              arguments: m.call.args,
            });
            const content = (res.result?.content ?? []) as Array<{ type: string; text?: string }>;
            const first = content.find((c) => c.type === "text")?.text ?? "";
            row.call = "ok";
            row.note = first.replace(/\s+/g, " ").slice(0, 48);
            console.log(`   ✓ tools/call ${m.call.name} → ${row.note}`);
          } catch (e) {
            row.call = "fail";
            row.note = e instanceof Error ? e.message.slice(0, 48) : "call failed";
            if (process.env.PROBE_DEBUG === "1") {
              console.log(`   ⚠ full call error: ${e instanceof Error ? e.message : e}`);
            }
          }
        }
      } catch (e) {
        row.note = e instanceof Error ? e.message.slice(0, 60) : "init failed";
        console.log(`   ❌ ${row.note}`);
        const log = await client.tail(boxId, logFileForMcp(m.slug), 30).catch(() => "");
        if (log) console.log(`   --- ${m.slug} log tail ---\n${log}\n   ------`);
      }
      rows.push(row);

      // Tear this MCP down before the next so peak usage stays at ONE MCP.
      // A small box can't hold 6 node/python servers + 6 supergateways at once
      // (the last ones OOM → 502). Production sizes the box to its MCP count;
      // here we prove each MCP in isolation, which is what we're asking.
      await client.exec(boxId, stopBridgeCommand(m.slug)).catch(() => undefined);
      await client.unexposePort(boxId, port).catch(() => undefined);
    }

    // 6. report
    console.log("\n================ MCP PUBLISH RESULTS ================");
    const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
    console.log(
      pad("MCP", 20) + pad("init", 6) + pad("tools", 7) + pad("call", 6) + "server / note"
    );
    console.log("-".repeat(72));
    for (const r of rows) {
      console.log(
        pad(r.slug, 20) +
          pad(r.init ? "✓" : "✗", 6) +
          pad(String(r.tools), 7) +
          pad(r.call, 6) +
          `${r.server}${r.note ? " · " + r.note : ""}`
      );
    }
    console.log("-".repeat(72));

    const proven = rows.filter((r) => r.init && r.tools > 0).length;
    const ok = proven === rows.length && rows.length > 0;
    console.log(
      ok
        ? `\n✅ ALL ${rows.length} MCPs PUBLISHED & WORKING — box → bridge → public URL → initialize → tools/list${rows.some((r) => r.call === "ok") ? " → tools/call" : ""}.`
        : `\n⚠️  ${proven}/${rows.length} MCPs fully working (see table above).`
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
