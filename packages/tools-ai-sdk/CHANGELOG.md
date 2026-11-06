# @upstash/twinmcp-tools-ai-sdk

## 0.3.0

### Minor Changes

- 41ba2f7: Publish under the `@twinmcp` npm scope and point every default URL at https://twinmcp.fr.
  - `@twinmcp/cli` (was `ctx7`): the command is now `twinmcp`. New hosting commands on the management API: `servers list|create`, `mcp list|search|install` (with typed `--config KEY=VALUE`), and `url` (whole-server, `--router`, or `--mcp`). `setup --server <slug>` writes the server URL and a newly created key bound to that server (scope `mcp_proxy`) into Claude Code, Cursor, Codex, Gemini CLI or OpenCode, with the `Authorization: Bearer` header the proxy expects. `login` stores a full-access API key (`--key` or a masked prompt). `connect` stops the whole tool process tree on Windows, handles Ctrl+Break, and no longer exits through `process.exit` (which crashes Node 24 on Windows after a fetch). The `skills` / `skill` / `generate` commands are no longer registered (twinmcp.fr serves no skills registry), `setup --cli` downloads the find-docs skill straight from GitHub, and usage events are not sent (no events endpoint yet).
  - Removed the legacy OAuth login (PKCE browser flow and token refresh against `/api/oauth/token`, which never existed): `twinmcp login` stores a full-access API key, and `connect` takes `--key`, `TWINMCP_API_KEY` or that stored key. Removed the legacy skills code (`skills` / `skill` / `generate` commands, IDE detection, dependency scanning, input parsing and their types). The dashboard prints `npx -y @twinmcp/cli connect --server <slug>` for local-agent servers.
  - `@twinmcp/sdk` (was `@upstash/twinmcp-sdk`), `@twinmcp/tools-ai-sdk` (was `@upstash/twinmcp-tools-ai-sdk`), `@twinmcp/mcp` (was `@upstash/twinmcp-mcp`): renamed; defaults use https://twinmcp.fr. The MCPB manifest asks for the API key at install time.

## 0.2.3

### Patch Changes

- 8322879: Improve resolve libryar id tool prompt to provide the libraryName query with proper format

## 0.2.2

### Patch Changes

- 02148ff: Bump zod from 3.x to 4.x

## 0.2.1

### Patch Changes

- 07a53dc: Upgrade ai peer dependency to >=6.0.0 for AI SDK v6 compatibility

## 0.2.0

### Minor Changes

- 9412e62: feat: Change SDK default response type from "txt" to "json" for both searchLibrary and getContext methods. AI SDK tools now explicitly use type: "txt" for LLM-friendly text responses.

### Patch Changes

- Updated dependencies [9412e62]
  - @upstash/twinmcp-sdk@0.3.0

## 0.1.0

### Minor Changes

- b3cd38a: feat: Rename tools to match MCP naming conventions
  - Rename `resolveLibrary` to `resolveLibraryId` with new `query` parameter
  - Rename `getLibraryDocs` to `queryDocs` with new `query` parameter (replaces `topic`)
  - Rename `RESOLVE_LIBRARY_DESCRIPTION` to `RESOLVE_LIBRARY_ID_DESCRIPTION`
  - Rename `GET_LIBRARY_DOCS_DESCRIPTION` to `QUERY_DOCS_DESCRIPTION`
  - Update type re-exports to match new SDK types (Library, Documentation, GetContextOptions)
  - Remove deprecated `defaultMaxResults` option from TwinMCPToolsConfig and TwinMCPAgentConfig
  - Add rate limiting guidance to tool descriptions

### Patch Changes

- Updated dependencies [b3cd38a]
  - @upstash/twinmcp-sdk@0.2.0
