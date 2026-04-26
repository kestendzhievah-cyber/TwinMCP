# @twinmcp/backend

Next.js 15 backend for TwinMCP — serves the API (`/api/v2/*`), OAuth endpoints for MCP HTTP transport, and the user dashboard.

## Development

```bash
pnpm install
pnpm --filter @twinmcp/backend dev
```

Then open <http://localhost:3000>. Health check: <http://localhost:3000/api/health>.

## Environment

Copy `.env.example` from the repo root to `.env.local` in this app and fill the values. See `PROVISIONING.md` at the repo root for how to obtain each secret.

## Structure

```
src/
  app/
    layout.tsx          Root layout
    page.tsx            Landing page
    api/
      health/route.ts   Liveness probe
```

## Next phases

- Phase 1: Drizzle schema + `/api/v2/{libs/search,context,auth/keys,usage}` + OAuth
- Phase 2: ingestion worker (separate `apps/ingest`)
- Phase 3: Clerk + OAuth 2.1 for MCP
- Phase 4: dashboard UI
