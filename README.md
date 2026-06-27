# TwinMCP

Multi-tenant SaaS where each user provisions their **own MCP server** — an
isolated runtime (Upstash Box) on which they install MCPs from a catalog — and
connects it to any LLM client (Claude Desktop, Cursor, Claude Code, Windsurf,
Cline) over the **Model Context Protocol**, with a copy-paste config.

## How it works

```
LLM client ──HTTP (Bearer ctx7sk_)──▶ control plane proxy
              /api/mcp/<server>/<mcp>          │
                                               ▼  (Bearer box-token)
                                   Upstash Box ── supergateway ── MCP (stdio)
```

- **Control plane** (`apps/backend`) — Next.js 15 (App Router), Drizzle ORM,
  Supabase Auth, Stripe billing. Owns users, servers, the MCP catalog, and the
  authenticated MCP proxy.
- **Runtime** — one Upstash Box per server; each installed MCP runs as a stdio
  process wrapped by `supergateway` and exposed on a bearer-protected URL. The
  proxy relays Streamable HTTP (`GET`/`POST`/`DELETE`, sessions, SSE).
- **TwinMCP Docs** — an official MCP served directly by the control plane
  (pgvector RAG over indexed library docs).

## The core flow

1. Sign up → pick a plan (Free advances; Pro/Team → Stripe Checkout).
2. Provision a server (1 click) — goes `running` only after a real MCP
   `initialize` succeeds.
3. Install an MCP from the catalog (secrets encrypted, AES-256-GCM).
4. Connect your LLM: copy the per-MCP URL `{origin}/api/mcp/{server}/{mcp}` +
   a `ctx7sk_` API key into your client's `mcp.json`. Done.

## Local development

```bash
pnpm install
cp .env.example apps/backend/.env.local   # fill in values (see PROVISIONING.md)
pnpm --filter @twinmcp/backend check-env   # validate the env contract
pnpm --filter @twinmcp/backend db:migrate  # extensions + migrations
pnpm --filter @twinmcp/backend seed:mcps   # official MCP catalog
pnpm dev:backend                           # http://localhost:3000
```

Without `UPSTASH_BOX_API_KEY`, the runtime runs in **stub mode** (dev only) — the
control plane and `twinmcp-docs` work, but real per-user MCP bridges don't.

## Deploy

Self-hosted VPS via Docker / Dokploy. See **[PRODUCTION.md](PRODUCTION.md)** and
**[PROVISIONING.md](PROVISIONING.md)**. Runtime architecture decision:
[docs/adr/0001-mcp-runtime.md](docs/adr/0001-mcp-runtime.md).

## Monorepo layout

| Path | What |
|------|------|
| `apps/backend` | Control plane (Next.js) + MCP proxy |
| `apps/ingest`  | Doc ingestion worker (BullMQ) for TwinMCP Docs |
| `packages/mcp` | Standalone "TwinMCP Docs" MCP server |
| `packages/sdk`, `packages/cli`, `packages/tools-ai-sdk` | Client SDKs/tooling |

## Useful commands

```bash
pnpm -r run typecheck        # all packages
pnpm --filter @twinmcp/backend lint
pnpm --filter @twinmcp/backend test
```

License: MIT.
