// Shared MCP client-config generation — used by onboarding (StepConnect) and the
// dashboard Connect panel. Keep this pure/client-safe (no server-only imports).

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

/**
 * The single source of truth for a connection URL: the authenticated control-plane
 * proxy, one URL per MCP. Never the raw box endpoint.
 */
export function proxyUrl(origin: string, serverSlug: string, mcpSlug: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp/${serverSlug}/${mcpSlug}`;
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
        code: `claude mcp add --transport http ${label} ${url} \\\n  --header "Authorization: ${authHeader}"`,
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
          `npx -y mcp-remote ${url} --header "Authorization: Bearer ${apiKey}"`,
          "",
          "# Quick handshake test:",
          `curl -s -X POST ${url} \\`,
          `  -H "Authorization: Bearer ${apiKey}" \\`,
          '  -H "Content-Type: application/json" \\',
          '  -H "Accept: application/json, text/event-stream" \\',
          `  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'`,
        ].join("\n"),
      };
  }
}

type RpcShape = { result?: Record<string, unknown>; error?: { message?: string } };

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

/**
 * Real connection test: POST an MCP `initialize` to the proxy URL with the API
 * key and require a valid JSON-RPC result (not just a health ping).
 */
export async function testMcpConnection(
  url: string,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "twinmcp-dashboard", version: "1.0.0" },
        },
      }),
    });

    if (res.status === 401) return { ok: false, message: "Unauthorized — check your API key." };
    if (res.status === 503) {
      return { ok: false, message: "Server isn't running yet — start it and retry in a moment." };
    }
    if (!res.ok) return { ok: false, message: `MCP endpoint returned HTTP ${res.status}.` };

    const parsed = parseRpc(await res.text());
    if (parsed?.result && (parsed.result.serverInfo || parsed.result.capabilities)) {
      const info = parsed.result.serverInfo as { name?: string } | undefined;
      return {
        ok: true,
        message: info?.name
          ? `Connected — "${info.name}" answered initialize.`
          : "Connected — the MCP answered initialize.",
      };
    }
    if (parsed?.error) {
      return { ok: false, message: `MCP error: ${parsed.error.message ?? "unknown"}` };
    }
    return { ok: false, message: "Unexpected response from the MCP endpoint." };
  } catch {
    return { ok: false, message: "Network error — try again." };
  }
}
