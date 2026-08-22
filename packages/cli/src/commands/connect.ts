import type { Command } from "commander";
import { spawn, type ChildProcess } from "node:child_process";
import { getBaseUrl } from "../utils/api.js";
import { log } from "../utils/logger.js";

// One local tool the agent should run, as delivered by the control plane over
// the link stream (config already decrypted, owner-only).
interface McpSpec {
  slug: string;
  name: string;
  runtime: string;
  startCmd: string;
  env: Record<string, unknown>;
}

interface RelayRequest {
  type: "request";
  id: string; // relay correlation id (matches back via /api/agent/respond)
  mcpSlug: string;
  body: string; // raw JSON-RPC request body from the LLM client
}

type LinkEvent =
  | { type: "init"; server: string; mcps: McpSpec[] }
  | RelayRequest
  | { type: "ping" };

export function registerConnectCommand(program: Command): void {
  program
    .command("connect")
    .description("Run local MCP tools (e.g. Blender) on this machine and relay them to TwinMCP")
    .requiredOption("--server <slug>", "your TwinMCP local-agent server slug")
    .option("--key <key>", "your TwinMCP API key (ctx7sk_…) — or set TWINMCP_API_KEY")
    .action(async (opts: { server: string; key?: string }) => {
      const apiKey = opts.key ?? process.env.TWINMCP_API_KEY;
      if (!apiKey || !apiKey.startsWith("ctx7sk_")) {
        log.error(
          "Provide your TwinMCP API key via --key ctx7sk_… or the TWINMCP_API_KEY env var."
        );
        log.dim("Generate one in your dashboard → server → Connect → Generate API key.");
        process.exit(1);
      }
      await runAgent(opts.server, apiKey);
    });
}

async function runAgent(serverSlug: string, apiKey: string): Promise<void> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const children = new Map<string, ChildProcess>();
  // "<mcpSlug>:<jsonRpcId>" → relay id, so a child's stdout response routes back
  // to the right relayed request.
  const pending = new Map<string, string>();

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.blank();
    log.warn("Shutting down agent…");
    for (const child of children.values()) child.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info(`TwinMCP agent → ${baseUrl}  ·  server '${serverSlug}'`);

  async function respond(id: string, ok: boolean, body: string): Promise<void> {
    try {
      await fetch(`${baseUrl}/api/agent/respond`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ id, ok, body }),
      });
    } catch (err) {
      log.error(`Failed to return a result to TwinMCP: ${String(err)}`);
    }
  }

  function spawnMcp(spec: McpSpec): void {
    if (children.has(spec.slug)) return;
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const [k, v] of Object.entries(spec.env ?? {})) env[k] = String(v);

    log.item(`starting ${spec.name}  (${spec.startCmd})`);
    const child = spawn(spec.startCmd, { shell: true, env });
    children.set(spec.slug, child);

    // MCP stdio is newline-delimited JSON-RPC on stdout; logs go to stderr.
    let buf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: string | number };
        try {
          msg = JSON.parse(line) as { id?: string | number };
        } catch {
          continue; // non-JSON banner/log line
        }
        if (msg.id === undefined || msg.id === null) continue; // notification
        const relayId = pending.get(`${spec.slug}:${msg.id}`);
        if (relayId) {
          pending.delete(`${spec.slug}:${msg.id}`);
          void respond(relayId, true, line);
        }
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trimEnd();
      if (text) log.dim(`[${spec.slug}] ${text}`);
    });
    child.on("exit", (code) => {
      children.delete(spec.slug);
      if (!shuttingDown) log.warn(`${spec.name} exited (code ${code ?? "?"})`);
    });
    child.on("error", (err) => {
      log.error(`${spec.name} failed to start: ${err.message}`);
    });
  }

  function handleRelay(evt: RelayRequest): void {
    const child = children.get(evt.mcpSlug);
    const rpcId = parseRpcId(evt.body);
    if (!child || !child.stdin?.writable) {
      void respond(
        evt.id,
        false,
        JSON.stringify({
          jsonrpc: "2.0",
          id: rpcId,
          error: { code: -32000, message: `Local tool '${evt.mcpSlug}' is not running` },
        })
      );
      return;
    }
    if (rpcId === null) {
      // Notification — no response expected; forward and ack immediately.
      child.stdin.write(ensureNewline(evt.body));
      void respond(evt.id, true, "");
      return;
    }
    pending.set(`${evt.mcpSlug}:${rpcId}`, evt.id);
    child.stdin.write(ensureNewline(evt.body));
  }

  // Link loop with exponential backoff; fatal auth/ownership errors stop it.
  for (let attempt = 0; !shuttingDown; attempt++) {
    try {
      if (attempt > 0) log.dim(`Reconnecting… (attempt ${attempt})`);
      await openLink(baseUrl, serverSlug, apiKey, {
        onInit: (mcps) => {
          log.success(`Linked '${serverSlug}' — ${mcps.length} local tool(s). Waiting for calls…`);
          for (const m of mcps) spawnMcp(m);
          if (mcps.length === 0) {
            log.warn("No local tools installed on this server yet — add one in the dashboard.");
          }
        },
        onRequest: handleRelay,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/^link (401|403|404|409)/.test(msg)) {
        log.error(`Cannot link: ${msg}`);
        log.dim("Check the API key and that '" + serverSlug + "' is a local-agent server you own.");
        shutdown();
        return;
      }
      log.error(`Link error: ${msg}`);
    }
    if (shuttingDown) break;
    await sleep(Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000));
  }
}

/** Open the SSE link and dispatch events until the stream ends. */
async function openLink(
  baseUrl: string,
  serverSlug: string,
  apiKey: string,
  handlers: { onInit: (mcps: McpSpec[]) => void; onRequest: (evt: RelayRequest) => void }
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/agent/link?server=${encodeURIComponent(serverSlug)}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: "text/event-stream" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`link ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.body) throw new Error("link: no response body");

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const rawEvent = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const dataLine = rawEvent.split(/\r?\n/).find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let evt: LinkEvent;
      try {
        evt = JSON.parse(dataLine.slice(5).trim()) as LinkEvent;
      } catch {
        continue;
      }
      if (evt.type === "init") handlers.onInit(evt.mcps);
      else if (evt.type === "request") handlers.onRequest(evt);
      // "ping" → keep-alive, ignore
    }
  }
}

function parseRpcId(body: string): string | number | null {
  try {
    const parsed = JSON.parse(body) as { id?: unknown } | Array<{ id?: unknown }>;
    const id = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
    return typeof id === "string" || typeof id === "number" ? id : null;
  } catch {
    return null;
  }
}

function ensureNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
