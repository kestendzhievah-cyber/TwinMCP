// Shared MCP client-config generation — used by onboarding (StepConnect) and the
// dashboard Connect panel. Keep this pure/client-safe (no server-only imports).

export type IdeKey = "cursor" | "claude-code" | "windsurf" | "cline" | "zed" | "other";

export interface ClientConfig {
  filename: string;
  language: string;
  code: string;
}

/** Placeholder shown before a real ctx7sk_ key is minted. */
export const API_KEY_PLACEHOLDER = "ctx7sk_xxxxxxxxxxxxxxxxxxxxxxxx";

/**
 * The single source of truth for a connection URL: the authenticated control-plane
 * proxy, one URL per MCP. Never the raw box endpoint.
 */
export function proxyUrl(origin: string, serverSlug: string, mcpSlug: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp/${serverSlug}/${mcpSlug}`;
}

export const IDE_LABELS: Record<IdeKey, string> = {
  cursor: "Cursor",
  "claude-code": "Claude Code",
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
  const httpEntry = { url, headers: { Authorization: `Bearer ${apiKey}` } };

  switch (ide) {
    case "cursor":
      return {
        filename: "~/.cursor/mcp.json",
        language: "json",
        code: JSON.stringify({ mcpServers: { [label]: httpEntry } }, null, 2),
      };
    case "claude-code":
      return {
        filename: "project .mcp.json (or ~/.claude.json)",
        language: "json",
        code: JSON.stringify({ mcpServers: { [label]: httpEntry } }, null, 2),
      };
    case "cline":
      return {
        filename: "Cline → MCP Servers (VS Code)",
        language: "json",
        code: JSON.stringify({ mcpServers: { [label]: httpEntry } }, null, 2),
      };
    case "windsurf":
      return {
        filename: "~/.codeium/windsurf/mcp_config.json",
        language: "json",
        code: JSON.stringify(
          {
            mcpServers: {
              [label]: { serverUrl: url, headers: { Authorization: `Bearer ${apiKey}` } },
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
          {
            context_servers: {
              [label]: {
                command: "npx",
                args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${apiKey}`],
              },
            },
          },
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
