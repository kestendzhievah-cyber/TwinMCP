// The "Works with your client" block on the marketing home: one copy-paste
// config per named MCP client, built by the SAME generator as the dashboard's
// Connect panel (lib/mcp/client-config.ts), so the example can never drift from
// what users actually paste. Placeholder server, MCP and key: the visitor has
// not minted a key yet.
//
// Pure and client-safe: no I/O. Unit-tested in src/__tests__/client-snippets.test.ts.

import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  MATRIX_CLIENTS,
  buildClientConfig,
  proxyUrl,
  type IdeKey,
} from "@/lib/mcp/client-config";

/** Placeholder server and MCP slugs shown in marketing snippets. */
export const EXAMPLE_SERVER_SLUG = "my-server";
export const EXAMPLE_MCP_SLUG = "fetch";

export interface ClientSnippet {
  id: IdeKey;
  label: string;
  filename: string;
  language: string;
  code: string;
}

/**
 * One snippet per named client (Cursor, Claude Desktop, Claude Code, VS Code,
 * Windsurf, Cline, Zed — whatever MATRIX_CLIENTS lists), in that order.
 */
export function marketingClientSnippets(origin: string): ClientSnippet[] {
  const url = proxyUrl(origin, EXAMPLE_SERVER_SLUG, EXAMPLE_MCP_SLUG);
  return MATRIX_CLIENTS.map((id) => {
    const cfg = buildClientConfig(id, {
      url,
      apiKey: API_KEY_PLACEHOLDER,
      label: EXAMPLE_MCP_SLUG,
    });
    return { id, label: IDE_LABELS[id], ...cfg };
  });
}
