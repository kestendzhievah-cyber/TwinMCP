---
"@twinmcp/cli": minor
"@twinmcp/sdk": minor
"@twinmcp/mcp": minor
"@twinmcp/tools-ai-sdk": minor
---

Publish under the `@twinmcp` npm scope and point every default URL at https://twinmcp.fr.

- `@twinmcp/cli` (was `ctx7`): the command is now `twinmcp`. New hosting commands on the management API: `servers list|create`, `mcp list|search|install` (with typed `--config KEY=VALUE`), and `url` (whole-server, `--router`, or `--mcp`). `setup --server <slug>` writes the server URL and a newly created key bound to that server (scope `mcp_proxy`) into Claude Code, Cursor, Codex, Gemini CLI or OpenCode, with the `Authorization: Bearer` header the proxy expects. `login` stores a full-access API key (`--key` or a masked prompt). `connect` stops the whole tool process tree on Windows, handles Ctrl+Break, and no longer exits through `process.exit` (which crashes Node 24 on Windows after a fetch). The `skills` / `skill` / `generate` commands are no longer registered (twinmcp.fr serves no skills registry), `setup --cli` downloads the find-docs skill straight from GitHub, and usage events are not sent (no events endpoint yet).
- Removed the legacy OAuth login (PKCE browser flow and token refresh against `/api/oauth/token`, which never existed): `twinmcp login` stores a full-access API key, and `connect` takes `--key`, `TWINMCP_API_KEY` or that stored key. Removed the legacy skills code (`skills` / `skill` / `generate` commands, IDE detection, dependency scanning, input parsing and their types). The dashboard prints `npx -y @twinmcp/cli connect --server <slug>` for local-agent servers.
- `@twinmcp/sdk` (was `@upstash/twinmcp-sdk`), `@twinmcp/tools-ai-sdk` (was `@upstash/twinmcp-tools-ai-sdk`), `@twinmcp/mcp` (was `@upstash/twinmcp-mcp`): renamed; defaults use https://twinmcp.fr. The MCPB manifest asks for the API key at install time.
