import type { Command } from "commander";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { getBaseUrl } from "../utils/api.js";
import { loadTokens } from "../utils/auth.js";
import { resolveApiKey } from "../utils/hosting.js";
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

export type LinkEvent =
  | { type: "init"; server: string; mcps: McpSpec[] }
  | RelayRequest
  | { type: "ping" };

export function registerConnectCommand(program: Command): void {
  program
    .command("connect")
    .description("Run local MCP tools (e.g. Blender) on this machine and relay them to TwinMCP")
    .requiredOption("--server <slug>", "your TwinMCP local-agent server slug")
    .option(
      "--key <key>",
      "your TwinMCP API key (ctx7sk_…); defaults to TWINMCP_API_KEY or `twinmcp login`"
    )
    .action(async (opts: { server: string; key?: string }) => {
      let resolved: ReturnType<typeof resolveApiKey> = null;
      try {
        resolved = resolveApiKey({
          flag: opts.key,
          env: process.env.TWINMCP_API_KEY,
          stored: loadTokens()?.access_token ?? null,
        });
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
      }
      if (!resolved) {
        log.error(
          "Provide your TwinMCP API key via --key ctx7sk_… or the TWINMCP_API_KEY env var."
        );
        log.dim("Generate one in your dashboard → server → Connect → Generate API key.");
        process.exitCode = 1;
        return;
      }
      await runAgent(opts.server, resolved.key);
    });
}

async function runAgent(serverSlug: string, apiKey: string): Promise<void> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const children = new Map<string, ChildProcess>();
  // "<mcpSlug>:<jsonRpcId>" → relay id, so a child's stdout response routes back
  // to the right relayed request.
  const pending = new Map<string, string>();

  // Shutdown lets the event loop drain instead of calling process.exit(): on
  // Windows (Node 24), exiting while a fetch socket is closing aborts with a
  // libuv assertion (exit code 127). Aborting the link stream, killing the
  // tools and clearing the backoff timer is enough for Node to exit by itself.
  const stop = new AbortController();
  let shuttingDown = false;
  const shutdown = (code = 0) => {
    if (shuttingDown) {
      process.exit(code === 0 ? 130 : code); // second Ctrl+C: don't wait
    }
    shuttingDown = true;
    log.blank();
    log.warn("Shutting down agent…");
    for (const child of children.values()) killTree(child);
    stop.abort();
    process.exitCode = code;
    // Last resort if something still holds the loop open.
    setTimeout(() => process.exit(code), 5000).unref();
  };
  const onSignal = () => shutdown(0);
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  // Ctrl+Break in a Windows console.
  if (process.platform === "win32") process.on("SIGBREAK", onSignal);

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
    // A shell resolves the command the way the user's terminal would (npx.cmd
    // and uvx.exe on Windows, PATH lookups everywhere). windowsHide keeps each
    // tool from opening its own console window.
    const child = spawn(spec.startCmd, { shell: true, env, windowsHide: true });
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
      await openLink(baseUrl, serverSlug, apiKey, stop.signal, {
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
      if (shuttingDown) break;
      const msg = err instanceof Error ? err.message : String(err);
      if (/^link (401|403|404|409)/.test(msg)) {
        log.error(`Cannot link: ${msg}`);
        log.dim("Check the API key and that '" + serverSlug + "' is a local-agent server you own.");
        shutdown(1);
        break;
      }
      log.error(`Link error: ${msg}`);
    }
    if (shuttingDown) break;
    await sleep(Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000), stop.signal);
  }
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  if (process.platform === "win32") process.off("SIGBREAK", onSignal);
}

/** Open the SSE link and dispatch events until the stream ends. */
async function openLink(
  baseUrl: string,
  serverSlug: string,
  apiKey: string,
  signal: AbortSignal,
  handlers: { onInit: (mcps: McpSpec[]) => void; onRequest: (evt: RelayRequest) => void }
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/agent/link?server=${encodeURIComponent(serverSlug)}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: "text/event-stream" },
    signal,
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
    const { events, rest } = drainSseEvents(buf);
    buf = rest;
    for (const evt of events) {
      if (evt.type === "init") handlers.onInit(evt.mcps);
      else if (evt.type === "request") handlers.onRequest(evt);
      // "ping" → keep-alive, ignore
    }
  }
}

/**
 * Splits complete SSE events off the buffer (blank-line separated; LF or CRLF,
 * since a proxy in front of the API may rewrite line endings) and returns the
 * parsed `data:` payloads plus the unfinished tail.
 */
export function drainSseEvents(buffer: string): { events: LinkEvent[]; rest: string } {
  let rest = buffer.replace(/\r\n/g, "\n");
  const events: LinkEvent[] = [];
  let sep: number;
  while ((sep = rest.indexOf("\n\n")) !== -1) {
    const rawEvent = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    const data = rawEvent
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as LinkEvent);
    } catch {
      // not JSON: ignore
    }
  }
  return { events, rest };
}

/**
 * How to stop a tool and everything it started. With `shell: true`, Windows
 * runs cmd.exe → npx.cmd → node/python; killing the cmd.exe pid alone leaves
 * the tool running, so the whole tree goes through taskkill. Elsewhere the
 * shell execs the command, so a plain signal reaches the tool.
 */
export function killCommand(
  platform: NodeJS.Platform,
  pid: number | undefined
): { cmd: string; args: string[] } | null {
  if (platform !== "win32" || !pid) return null;
  return { cmd: "taskkill", args: ["/pid", String(pid), "/T", "/F"] };
}

function killTree(child: ChildProcess): void {
  const kill = killCommand(process.platform, child.pid);
  if (kill) {
    const res = spawnSync(kill.cmd, kill.args, { stdio: "ignore", windowsHide: true });
    if (!res.error && res.status === 0) return;
  }
  child.kill();
}

export function parseRpcId(body: string): string | number | null {
  try {
    const parsed = JSON.parse(body) as { id?: unknown } | Array<{ id?: unknown }>;
    const id = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
    return typeof id === "string" || typeof id === "number" ? id : null;
  } catch {
    return null;
  }
}

export function ensureNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

/** Resolves after `ms`, or as soon as `signal` aborts (so shutdown is immediate). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
