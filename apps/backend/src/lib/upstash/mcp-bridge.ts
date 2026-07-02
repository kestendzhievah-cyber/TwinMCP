// In-box stdio→HTTP bridge for user MCP servers.
//
// Each installed MCP (a stdio process like `mcp-server-filesystem`) is wrapped by
// `supergateway`, which exposes it over Streamable HTTP on a deterministic port.
// That port is then published to a bearer-protected public URL via the Box SDK
// (`getPublicURL`). The control plane proxy forwards client traffic to that URL.
//
// The exact supergateway flags live HERE so they are trivial to adjust against a
// live Upstash Box at deploy time (see docs/adr/0001-mcp-runtime.md).

/** First port assigned to an MCP bridge inside a box. */
export const BRIDGE_BASE_PORT = 8080;

/** Path supergateway serves the Streamable HTTP MCP transport on. */
export const MCP_STREAM_PATH = "/mcp";

// The box runs as a non-root user whose home (and only writable persistent dir)
// is /workspace/home — the workspace root /workspace is NOT user-writable.
const BOX_WORKDIR = "/workspace/home";

/** Path of the per-MCP launcher script written into the box. */
export function launcherPath(slug: string): string {
  return `${BOX_WORKDIR}/mcp-${safeSlug(slug)}.sh`;
}

/** Path of the aggregate init script replayed when a keep-alive box resumes. */
export const INIT_SCRIPT_PATH = `${BOX_WORKDIR}/init-mcps.sh`;

/** Log file an MCP bridge writes to inside the box. */
export function logFileForMcp(slug: string): string {
  return `/tmp/mcp-${safeSlug(slug)}.log`;
}

/** PID file an MCP bridge writes so it can be stopped by PID. */
export function pidPath(slug: string): string {
  return `${BOX_WORKDIR}/mcp-${safeSlug(slug)}.pid`;
}

function safeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9_-]/gi, "_");
}

/** Emit `export KEY='value'` lines for env-safe keys only (UPPER_SNAKE). */
function envExports(config: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(config)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) continue;
    const escaped = String(v).replace(/'/g, "'\\''");
    lines.push(`export ${k}='${escaped}'`);
  }
  return lines.join("\n");
}

/**
 * Build the per-MCP launcher script. It exports the MCP's config as env vars,
 * then runs supergateway in the foreground (the init script backgrounds it).
 */
export function buildLauncherScript(opts: {
  slug: string;
  startCmd: string;
  port: number;
  config: Record<string, unknown>;
}): string {
  const exports = envExports(opts.config);
  // The MCP stdio command. supergateway runs it and bridges stdio↔HTTP.
  const stdio = opts.startCmd.replace(/"/g, '\\"');
  return [
    "#!/bin/sh",
    "set -e",
    // Make uv-installed tools resolvable (Python MCP servers run via `uvx`).
    'export PATH="$HOME/.local/bin:$PATH"',
    exports,
    // Record the PID `exec` will inherit so the process can be stopped later.
    `echo $$ > ${pidPath(opts.slug)}`,
    `exec npx -y supergateway \\`,
    `  --stdio "${stdio}" \\`,
    `  --outputTransport streamableHttp \\`,
    `  --streamableHttpPath ${MCP_STREAM_PATH} \\`,
    `  --port ${opts.port} \\`,
    `  --healthEndpoint /healthz \\`,
    `  --cors`,
    "",
  ].join("\n");
}

/** Command that stops a running MCP bridge by its recorded PID. */
export function stopBridgeCommand(slug: string): string {
  const pid = pidPath(slug);
  return `kill "$(cat ${pid} 2>/dev/null)" 2>/dev/null; rm -f ${pid}; true`;
}

/**
 * Command that backgrounds a single MCP launcher (used at install time and by
 * the resume init script). `< /dev/null` fully detaches stdin and `nohup`
 * detaches from SIGHUP, so the daemon survives after the `exec` session that
 * launched it returns — the common reason an exec-launched process gets reaped.
 */
export function startBridgeCommand(slug: string): string {
  return `nohup sh ${launcherPath(slug)} < /dev/null > ${logFileForMcp(slug)} 2>&1 &`;
}

/** Build the aggregate init script that (re)launches every MCP bridge in the background. */
export function buildInitScript(slugs: string[]): string {
  const lines = ["#!/bin/sh"];
  for (const slug of slugs) lines.push(startBridgeCommand(slug));
  lines.push("");
  return lines.join("\n");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function parseJsonRpc(text: string): { result?: Record<string, unknown>; error?: unknown } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Streamable HTTP may answer as SSE: `event: message\ndata: {...}`.
  const dataLine = trimmed.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const payload = dataLine ? dataLine.slice("data:".length).trim() : trimmed;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Real MCP healthcheck: POST `initialize` to the public URL and require a valid
 * JSON-RPC result (serverInfo or capabilities). Retries while the bridge warms up.
 */
export async function healthcheckMcp(
  publicUrl: string,
  token: string | null,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<boolean> {
  // Generous by default: the first bridge start cold-downloads supergateway AND
  // the MCP package via npx (~30-60s) before it can answer.
  const attempts = opts.attempts ?? 30;
  const delayMs = opts.delayMs ?? 3_000;
  const target = publicUrl.replace(/\/$/, "") + MCP_STREAM_PATH;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "twinmcp-healthcheck", version: "1.0.0" },
    },
  });

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
      if (res.ok) {
        const parsed = parseJsonRpc(await res.text());
        const result = parsed?.result;
        if (result && (result.serverInfo || result.capabilities)) return true;
      }
    } catch {
      // bridge not up yet — retry
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return false;
}
