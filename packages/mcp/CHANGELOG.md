# @upstash/twinmcp-mcp

## 2.2.0

### Minor Changes

- 41ba2f7: Publish under the `@twinmcp` npm scope and point every default URL at https://twinmcp.fr.
  - `@twinmcp/cli` (was `ctx7`): the command is now `twinmcp`. New hosting commands on the management API: `servers list|create`, `mcp list|search|install` (with typed `--config KEY=VALUE`), and `url` (whole-server, `--router`, or `--mcp`). `setup --server <slug>` writes the server URL and a newly created key bound to that server (scope `mcp_proxy`) into Claude Code, Cursor, Codex, Gemini CLI or OpenCode, with the `Authorization: Bearer` header the proxy expects. `login` stores a full-access API key (`--key` or a masked prompt). `connect` stops the whole tool process tree on Windows, handles Ctrl+Break, and no longer exits through `process.exit` (which crashes Node 24 on Windows after a fetch). The `skills` / `skill` / `generate` commands are no longer registered (twinmcp.fr serves no skills registry), `setup --cli` downloads the find-docs skill straight from GitHub, and usage events are not sent (no events endpoint yet).
  - Removed the legacy OAuth login (PKCE browser flow and token refresh against `/api/oauth/token`, which never existed): `twinmcp login` stores a full-access API key, and `connect` takes `--key`, `TWINMCP_API_KEY` or that stored key. Removed the legacy skills code (`skills` / `skill` / `generate` commands, IDE detection, dependency scanning, input parsing and their types). The dashboard prints `npx -y @twinmcp/cli connect --server <slug>` for local-agent servers.
  - `@twinmcp/sdk` (was `@upstash/twinmcp-sdk`), `@twinmcp/tools-ai-sdk` (was `@upstash/twinmcp-tools-ai-sdk`), `@twinmcp/mcp` (was `@upstash/twinmcp-mcp`): renamed; defaults use https://twinmcp.fr. The MCPB manifest asks for the API key at install time.

## 2.1.8

### Patch Changes

- 00833f9: Preserve Node's default trusted CAs when `NODE_EXTRA_CA_CERTS` is configured, and add a regression test for custom CA loading.

## 2.1.7

### Patch Changes

- 658ec67: Add --version/-v flag to MCP CLI
- 8322879: Improve resolve libryar id tool prompt to provide the libraryName query with proper format

## 2.1.6

### Patch Changes

- a667712: Update search filter warning
- be1a39a: Update server metadata and instructions.

## 2.1.5

### Patch Changes

- 2070cb1: Support NODE_EXTRA_CA_CERTS for enterprise MITM proxies by injecting custom CA certificates into undici's global dispatcher at runtime

## 2.1.4

### Patch Changes

- 9de3f06: Display warning when public library access filter is being used to filter libraries.

## 2.1.3

### Patch Changes

- 9523522: Reject GET requests on MCP endpoints with 405 to eliminate idle SSE connection timeouts
- 59d0327: Include source field in search result response

## 2.1.2

### Patch Changes

- 617d8ed: Remove unnecessary warning and update tool descriptions

## 2.1.1

### Patch Changes

- 02148ff: Bump zod from 3.x to 4.x

## 2.1.0

### Minor Changes

- ef82f30: Add OAuth 2.0 authentication support for MCP server
  - Add new `/mcp/oauth` endpoint requiring JWT authentication
  - Implement JWT validation against authorization server JWKS
  - Add OAuth Protected Resource Metadata endpoint (RFC 9728) at `/.well-known/oauth-protected-resource`
  - Include `WWW-Authenticate` header for OAuth discovery

## 2.0.2

### Patch Changes

- 368b143: Collect client and server version metrics

## 2.0.1

### Patch Changes

- 93a2d5b: Adds MCP tool annotations (readOnlyHint) to all tools to help MCP clients better understand tool behavior and make safer decisions about tool execution.

## 2.0.0

### Major Changes

- 66ea0d6: Upgrade MCP server to v2.0.0 with intelligent query-based architecture

  Breaking Changes
  - Removed get-library-docs tool, replaced with new query-docs tool
  - resolve-library-id now requires both query and libraryName parameters
  - Removed mode, topic, page, and limit parameters from documentation fetching
  - Renamed twinmcpCompatibleLibraryID parameter to libraryId

  New Features
  - Intelligent reranked and deduplicated library selection based on user intent
  - Smart snippet selection with relevance-based ranking for documentation retrieval
  - Query-driven context fetching that understands what the user is trying to accomplish
  - Added security warnings for sensitive data in query parameters
  - Added tool call limits (max 3 calls per question) to prevent excessive context window usage

  Improvements
  - Simplified API key header extraction (removed redundant case variants)
  - Removed unused actualPort variable and dead code
  - Cleaner type definitions with new ContextRequest and ContextResponse types
  - Better error messages for library search failures

## 1.0.33

### Patch Changes

- a5228fd: Fix API key not being passed in resolve-library-id tool when using stdio transport

## 1.0.32

### Patch Changes

- ad23996: Remove masked API key display from unauthorized error responses
- aa12390: Improve error message handling by using the responses from the server.

## 1.0.31

### Patch Changes

- 6255e26: Migrate to pnpm monorepo structure
