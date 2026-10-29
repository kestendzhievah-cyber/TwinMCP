# @twinmcp/mcp — TwinMCP Docs MCP server

An MCP server that gives AI coding assistants version-specific library documentation from the
TwinMCP documentation API (`https://twinmcp.fr/api/v2`). Two tools:

- `resolve-library-id` turns a package name into a TwinMCP library ID (e.g. `/facebook/react`).
- `query-docs` returns documentation and code examples for that ID and a question.

Every call needs a TwinMCP API key (`ctx7sk_…`). Create one at
[twinmcp.fr/dashboard](https://twinmcp.fr/dashboard).

## Hosted: nothing to install

Every TwinMCP server in a cloud runtime gets TwinMCP Docs installed automatically. Connect your
client to the server's URL with your key, as the dashboard's **Connect** panel shows:

```
https://twinmcp.fr/api/mcp/<server-slug>                 (every MCP of the server)
https://twinmcp.fr/api/mcp/<server-slug>/twinmcp-docs    (only TwinMCP Docs)
Authorization: Bearer ctx7sk_…
```

Or let the CLI write the client config: `npx @twinmcp/cli setup --server <server-slug>`.

## Local: stdio

Runs on your machine with Node.js 18 or later.

Cursor (`~/.cursor/mcp.json`), Claude Desktop (`claude_desktop_config.json`) and most stdio
clients:

```json
{
  "mcpServers": {
    "twinmcp-docs": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp"],
      "env": { "TWINMCP_API_KEY": "ctx7sk_…" }
    }
  }
}
```

On Windows, clients that cannot start `npx` directly need `"command": "cmd"` and
`"args": ["/c", "npx", "-y", "@twinmcp/mcp"]`.

Claude Code:

```bash
claude mcp add twinmcp-docs -e TWINMCP_API_KEY=ctx7sk_… -- npx -y @twinmcp/mcp
```

The key can also be passed as `--api-key ctx7sk_…` instead of the environment variable.

## Self-hosted: HTTP

```bash
pnpm --filter @twinmcp/mcp build
node packages/mcp/dist/index.js --transport http --port 8080
```

or with the [Dockerfile](Dockerfile) (build context: the repository root). The server answers on
`/mcp` (the key is forwarded to the API, which rejects calls without one) and `/mcp/oauth`
(answers 401 without a key, so OAuth-capable clients start a sign-in). Clients send the
key as `Authorization: Bearer ctx7sk_…` (also accepted: `TWINMCP-API-KEY` or `X-API-KEY` headers).

| Variable                              | Default                  | Purpose                                                |
| ------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `TWINMCP_API_URL`                     | `https://twinmcp.fr/api` | Documentation API base                                 |
| `RESOURCE_URL`                        | `https://twinmcp.fr`     | Public URL of this server, for OAuth resource metadata |
| `AUTH_SERVER_URL`                     | `https://twinmcp.fr`     | OAuth authorization server advertised to clients       |
| `CLIENT_IP_ENCRYPTION_KEY`            | built-in                 | Key used to encrypt the forwarded client IP            |
| `HTTPS_PROXY` / `NODE_EXTRA_CA_CERTS` | unset                    | Outbound proxy and extra CA certificates               |

## Claude Desktop extension (MCPB)

`mcpb/manifest.json` describes the `.mcpb` bundle; it asks for the API key at install time.
Rebuild the bundle with `pnpm --filter @twinmcp/mcp pack-mcpb` (needs a POSIX shell and the
`mcpb` CLI).

## Development

```bash
pnpm --filter @twinmcp/mcp build
pnpm --filter @twinmcp/mcp test
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

## License

MIT, see [LICENSE](LICENSE).
