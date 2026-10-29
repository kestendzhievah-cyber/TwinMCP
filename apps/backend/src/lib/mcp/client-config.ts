// Shared MCP client-config generation — used by onboarding (StepConnect) and the
// dashboard Connect panel. Keep this pure/client-safe (no server-only imports).

import { WARNINGS_META_KEY } from "./aggregate";

export type IdeKey =
  | "cursor"
  | "claude-desktop"
  | "claude-code"
  | "vscode"
  | "windsurf"
  | "cline"
  | "zed"
  | "other";

export interface ClientConfig {
  filename: string;
  language: string;
  code: string;
}

/** Placeholder shown before a real ctx7sk_ key is minted. Worded so it reads as
 *  "replace me", not a censored real key. */
export const API_KEY_PLACEHOLDER = "ctx7sk_YOUR_KEY_HERE";

// When the API runs on a dedicated origin (e.g. https://api.twinmcp.fr), its
// root IS the API — middleware maps /mcp/* onto /api/mcp/* — so we build clean
// URLs against it and drop the /api prefix. Unset → same-origin /api/mcp/* as
// before. See docs/API-SUBDOMAIN.md.
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

/**
 * The single source of truth for a connection URL: the authenticated control-plane
 * proxy, one URL per MCP. Never the raw box endpoint.
 */
export function proxyUrl(origin: string, serverSlug: string, mcpSlug: string): string {
  if (API_URL) return `${API_URL}/mcp/${serverSlug}/${mcpSlug}`;
  return `${origin.replace(/\/$/, "")}/api/mcp/${serverSlug}/${mcpSlug}`;
}

/**
 * One URL for a whole server (contract D3): every enabled MCP of the server
 * behind a single endpoint, tools named `<mcp>__<tool>`. With `router`, the
 * endpoint lists three meta-tools (search_tools, get_tool_schema, call_tool)
 * instead of every tool — for servers with many tools. Same snippets as a
 * per-MCP URL: pass it to buildClientConfig with serverConfigLabel().
 */
export function buildServerUrl(
  origin: string,
  serverSlug: string,
  opts: { router?: boolean } = {}
): string {
  const base = API_URL
    ? `${API_URL}/mcp/${serverSlug}`
    : `${origin.replace(/\/$/, "")}/api/mcp/${serverSlug}`;
  return opts.router ? `${base}?mode=router` : base;
}

/** The entry name of a whole-server connection in a client config. */
export function serverConfigLabel(serverSlug: string): string {
  return `twinmcp-${serverSlug}`;
}

export const IDE_LABELS: Record<IdeKey, string> = {
  cursor: "Cursor",
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  vscode: "VS Code (Copilot)",
  windsurf: "Windsurf",
  cline: "Cline",
  zed: "Zed",
  other: "Other / generic",
};

/** Named clients for the /servers/<mcp>/<client> SEO matrix (excludes the
 *  generic "other" catch-all). Used by the page's generateStaticParams and the
 *  sitemap so both stay in sync. */
export const MATRIX_CLIENTS = (Object.keys(IDE_LABELS) as IdeKey[]).filter((k) => k !== "other");

/** Build a copy-paste config block for the given IDE. */
export function buildClientConfig(
  ide: IdeKey,
  opts: { url: string; apiKey: string; label: string }
): ClientConfig {
  const { url, apiKey, label } = opts;
  const authHeader = `Bearer ${apiKey}`;
  // Native Streamable-HTTP entry: a URL plus the bearer Authorization header.
  const httpEntry = { url, headers: { Authorization: authHeader } };
  // stdio→remote bridge for clients that only load local (stdio) servers.
  const remoteArgs = ["-y", "mcp-remote", url, "--header", `Authorization: ${authHeader}`];
  // On a shell line, a URL with a query (`?mode=router`) must be quoted: zsh
  // (the macOS default) treats an unquoted `?` as a glob and aborts.
  const shellUrl = /[?&*\s]/.test(url) ? `"${url}"` : url;

  switch (ide) {
    case "cursor":
      // Cursor speaks Streamable HTTP natively (url + headers).
      return {
        filename: "~/.cursor/mcp.json  (or project .cursor/mcp.json)",
        language: "json",
        code: JSON.stringify({ mcpServers: { [label]: httpEntry } }, null, 2),
      };
    case "claude-desktop":
      // Claude Desktop loads stdio servers only — bridge the remote URL with
      // mcp-remote (requires Node/npx on the machine).
      return {
        filename:
          "claude_desktop_config.json  ·  macOS: ~/Library/Application Support/Claude/  ·  Windows: %APPDATA%\\Claude\\",
        language: "json",
        code: JSON.stringify(
          { mcpServers: { [label]: { command: "npx", args: remoteArgs } } },
          null,
          2
        ),
      };
    case "claude-code":
      // Canonical path: the CLI registers an HTTP transport with the auth header.
      return {
        filename: "Claude Code — run in your terminal",
        language: "bash",
        code: `claude mcp add --transport http ${label} ${shellUrl} \\\n  --header "Authorization: ${authHeader}"`,
      };
    case "vscode":
      // VS Code MCP: .vscode/mcp.json uses "servers" with an explicit "http" type.
      return {
        filename: ".vscode/mcp.json",
        language: "json",
        code: JSON.stringify(
          {
            servers: {
              [label]: { type: "http", url, headers: { Authorization: authHeader } },
            },
          },
          null,
          2
        ),
      };
    case "windsurf":
      // Windsurf references a remote MCP server by `serverUrl`.
      return {
        filename: "~/.codeium/windsurf/mcp_config.json",
        language: "json",
        code: JSON.stringify(
          {
            mcpServers: {
              [label]: { serverUrl: url, headers: { Authorization: authHeader } },
            },
          },
          null,
          2
        ),
      };
    case "cline":
      // Cline (VS Code) — Streamable HTTP remote server; type made explicit.
      return {
        filename: "Cline → MCP Servers → Configure  (cline_mcp_settings.json)",
        language: "json",
        code: JSON.stringify(
          {
            mcpServers: {
              [label]: { type: "streamableHttp", url, headers: { Authorization: authHeader } },
            },
          },
          null,
          2
        ),
      };
    case "zed":
      // Zed context servers are stdio-only — bridge the remote URL with mcp-remote.
      return {
        filename: "~/.config/zed/settings.json",
        language: "json",
        code: JSON.stringify(
          { context_servers: { [label]: { command: "npx", args: remoteArgs } } },
          null,
          2
        ),
      };
    case "other":
    default:
      return {
        filename: "Any MCP client (Streamable HTTP)",
        language: "bash",
        code: [
          "# TwinMCP MCP endpoint (Streamable HTTP)",
          `URL:    ${url}`,
          `Header: Authorization: Bearer ${apiKey}`,
          "",
          "# Bridge a stdio-only client with mcp-remote:",
          `npx -y mcp-remote ${shellUrl} --header "Authorization: Bearer ${apiKey}"`,
          "",
          "# Quick handshake test:",
          `curl -s -X POST ${shellUrl} \\`,
          `  -H "Authorization: Bearer ${apiKey}" \\`,
          '  -H "Content-Type: application/json" \\',
          '  -H "Accept: application/json, text/event-stream" \\',
          `  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'`,
        ].join("\n"),
      };
  }
}

type RpcShape = {
  result?: Record<string, unknown>;
  error?: { message?: string };
  message?: string;
};

/** Parse a JSON or single-event SSE body (Streamable HTTP answers either way). */
function parseRpc(text: string): RpcShape | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dataLine = trimmed.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const payload = dataLine ? dataLine.slice("data:".length).trim() : trimmed;
  try {
    return JSON.parse(payload) as RpcShape;
  } catch {
    return null;
  }
}

/** Does an aggregated tools/list `_meta` flag an MCP as still waking/installing? */
export function hasWakingMcp(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const warnings = (meta as Record<string, unknown>)[WARNINGS_META_KEY];
  return (
    Array.isArray(warnings) &&
    warnings.some(
      (w) => !!w && typeof w === "object" && (w as { state?: unknown }).state === "waking"
    )
  );
}

/** The outcome of {@link testMcpConnection}. */
export interface McpConnectionTestResult {
  /** True when both `initialize` and `tools/list` succeeded. */
  ok: boolean;
  /** Tool names from `tools/list` (present when ok). */
  tools?: string[];
  /**
   * The proxy answered 503 because the MCP is still installing, the server is
   * still provisioning or the box is waking from idle: retry shortly.
   */
  installing?: boolean;
  /** Human-readable outcome, safe to show as-is. */
  message: string;
}

// The proxy may spend ~30 s waking a paused box before it answers, so the
// per-request timeout sits above that.
const TEST_TIMEOUT_MS = 45_000;

// 503 messages from the proxy that mean "not ready yet" rather than "stopped".
const NOT_READY_RE = /install|waking|provisioning|not yet provisioned|warm/i;

/** "fetch" from ".../api/mcp/my-server/fetch" — the MCP label when none is given. */
function slugFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "The MCP";
  } catch {
    return "The MCP";
  }
}

/**
 * Real connection test, the same handshake an IDE performs: POST `initialize`
 * to the proxy URL with the API key, send `notifications/initialized`, then
 * `tools/list`, and require a valid JSON-RPC result for both (not just a
 * health ping). None of these is a `tools/call`, so the test never consumes
 * the daily quota (lib/mcp/billable.ts).
 *
 * `mcpLabel` names the MCP in the "still installing" message; it defaults to
 * the last segment of the URL. Callers that read only `ok`/`message` keep
 * working unchanged.
 */
export async function testMcpConnection(
  url: string,
  apiKey: string,
  mcpLabel?: string
): Promise<McpConnectionTestResult> {
  const label = mcpLabel?.trim() || slugFromUrl(url);
  const installingResult: McpConnectionTestResult = {
    ok: false,
    installing: true,
    message: `${label} is still installing — this takes about a minute.`,
  };
  let sessionId: string | null = null;

  const post = (body: unknown) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${apiKey}`,
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? { signal: AbortSignal.timeout(TEST_TIMEOUT_MS) }
        : {}),
    });
  };

  /** Map a non-2xx proxy answer to a result; null when the status is OK. */
  const httpFailure = async (res: Response): Promise<McpConnectionTestResult | null> => {
    if (res.ok) return null;
    if (res.status === 401) return { ok: false, message: "Unauthorized — check your API key." };
    if (res.status === 503) {
      const body = parseRpc(await res.text().catch(() => ""));
      const detail = body?.error?.message ?? body?.message ?? "";
      if (NOT_READY_RE.test(detail)) return installingResult;
      return { ok: false, message: "Server isn't running yet — start it and retry in a moment." };
    }
    if (res.status === 429) {
      return { ok: false, message: "Daily request limit reached — see Billing for your quota." };
    }
    return { ok: false, message: `MCP endpoint returned HTTP ${res.status}.` };
  };

  try {
    // 1. initialize
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "twinmcp-dashboard", version: "1.0.0" },
      },
    });
    const initFailure = await httpFailure(init);
    if (initFailure) return initFailure;
    sessionId = init.headers.get("mcp-session-id");

    const initRpc = parseRpc(await init.text());
    if (initRpc?.error) {
      return { ok: false, message: `MCP error: ${initRpc.error.message ?? "unknown"}` };
    }
    if (!initRpc?.result || !(initRpc.result.serverInfo || initRpc.result.capabilities)) {
      return { ok: false, message: "Unexpected response from the MCP endpoint." };
    }
    const info = initRpc.result.serverInfo as { name?: string } | undefined;

    // 2. notifications/initialized — required by the protocol before other
    // requests; its answer (202, or nothing useful) is ignored.
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })
      .then((r) => r.text())
      .catch(() => undefined);

    // 3. tools/list
    const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listFailure = await httpFailure(list);
    if (listFailure) return listFailure;
    const listRpc = parseRpc(await list.text());
    if (listRpc?.error) {
      return {
        ok: false,
        message: `Connected, but tools/list failed: ${listRpc.error.message ?? "unknown error"}`,
      };
    }
    const rawTools = listRpc?.result?.tools;
    if (!Array.isArray(rawTools)) {
      return { ok: false, message: "Connected, but the MCP returned no tool list." };
    }
    const tools = rawTools
      .map((t) => (t && typeof t === "object" ? (t as { name?: unknown }).name : undefined))
      .filter((n): n is string => typeof n === "string");

    // The whole-server endpoint lists what it can and flags an MCP that is
    // still installing or waking in `_meta`: keep waiting for it, so the test
    // only passes once every MCP answers (the hook retries for 2 minutes).
    if (hasWakingMcp(listRpc?.result?._meta)) return { ...installingResult, tools };

    // Close the test session (best effort, never awaited).
    if (sessionId) {
      void fetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiKey}`, "mcp-session-id": sessionId },
      }).catch(() => undefined);
    }

    const who = info?.name ? `"${info.name}"` : "the MCP";
    return {
      ok: true,
      tools,
      message: `Connected — ${who} answered initialize and listed ${tools.length} tool${
        tools.length === 1 ? "" : "s"
      }.`,
    };
  } catch (err) {
    // Our own timeout: the proxy is still waking the box.
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return installingResult;
    }
    return { ok: false, message: "Network error — try again." };
  }
}
