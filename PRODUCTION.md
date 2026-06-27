# TwinMCP — Production deploy (self-hosted VPS via Docker / Dokploy)

TwinMCP runs as a single Next.js standalone container on a VPS, orchestrated by
Dokploy. Per-user MCP runtimes are provisioned on Upstash Box; managed
dependencies (Postgres, Redis, QStash) are Supabase/Upstash. There is **no
Vercel** in this path.

> Replace `twinmcp.fr` with your real domain throughout.

## 1. Prerequisites

- A VPS with Docker + Docker Compose and Dokploy installed.
- The repo deployed to `/opt/twinmcp` on the VPS (Dokploy app dir).
- All env vars from `.env.example` obtained — see [PROVISIONING.md](PROVISIONING.md).
- `pnpm --filter @twinmcp/backend check-env` is green with your `.env`.

## 2. Environment: build args vs runtime

`NEXT_PUBLIC_*` are **inlined at build time**, so they MUST be available as
Docker **build args** (`docker-compose.yml` forwards them from the Dokploy env).
Everything else is read at **runtime**. In Dokploy, set the full env on the
project; the compose build args reference it.

Build-arg vars (must be set before/at build): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SENTRY_DSN`.

## 3. Database: extensions → migrate → seed

`db:migrate` now applies `0000_init_extensions.sql` (`vector`, `pg_trgm`)
**before** the Drizzle migrator, so the extensions can't be forgotten. The
deploy workflow runs `db:migrate` automatically after each deploy. Seed the MCP
catalog once:

```bash
pnpm --filter @twinmcp/backend db:migrate     # extensions + migrations
pnpm --filter @twinmcp/backend seed:mcps       # 5 official MCPs
```

## 4. Queue strategy (provisioning durability)

Provisioning/lifecycle work runs through `enqueue()`:

- **Recommended:** set `QSTASH_TOKEN` + `QSTASH_CURRENT_SIGNING_KEY` +
  `QSTASH_NEXT_SIGNING_KEY` + `APP_URL` (public origin). Jobs are published to
  QStash, which **retries** and survives container restarts. `/api/jobs/run`
  rejects unsigned calls in production.
- **Acceptable fallback:** with QStash unset, jobs run **inline in-process**.
  This is safe on the long-lived VPS container (unlike serverless), but a
  restart loses any job mid-flight and there are no retries. Use QStash for
  production durability.

## 5. CI/CD (`.github/workflows/deploy.yml`)

On push to `main`: test → build & push image to GHCR → SSH to `/opt/twinmcp`
(`docker compose pull && up -d`, snapshotting the old image as `:previous`) →
`db:migrate` → smoke test → **auto-rollback** to `:previous` on failure.

Required GitHub config:
- Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (opt),
  `DATABASE_URL_UNPOOLED`.
- Variable: `BASE_URL` = `https://twinmcp.fr`.

## 6. Pre-launch checklist

### Core feature (per-user MCP → LLM)
- [ ] `UPSTASH_BOX_API_KEY` set (prod refuses to provision in stub mode).
- [ ] `CONFIG_ENCRYPTION_KEY` set (32-byte hex) — MCP secrets won't en/decrypt without it.
- [ ] End-to-end smoke (see §7) passes: create server → install an MCP → a real
      MCP client `initialize`s + lists + calls a tool.

### Auth & security
- [ ] Supabase Auth providers active (Email, GitHub, Google).
- [ ] MCP auth = `ctx7sk_` API key (Bearer). OAuth is **off by default**
      (`OAUTH_ENABLED` unset → discovery + `/oauth/*` return 404). Only enable it
      once the OAuth stores are DB-backed, then set the `OAUTH_JWT_*` keys.
- [ ] `CORS_ORIGIN` = your origin (not `*`).
- [ ] `TWINMCP_ALLOW_DEV_AUTH` is **unset** (it bypasses MCP-proxy auth).
- [ ] `CLIENT_IP_ENCRYPTION_KEY` set.

### Billing
- [ ] Stripe products + `price_...` IDs set (Pro monthly at minimum).
- [ ] Webhook `https://twinmcp.fr/api/webhooks/stripe` configured + secret set.
- [ ] Test: signup → checkout → webhook → `users.plan` updated.

### Deploy
- [ ] `pnpm --filter @twinmcp/backend check-env` green.
- [ ] GitHub secrets/variables set; first deploy succeeds; `/api/health` healthy.

## 7. Verification

```bash
# Env contract
pnpm --filter @twinmcp/backend check-env

# Health (after deploy)
curl -fsS https://twinmcp.fr/api/health

# Core MCP smoke test (needs a ctx7sk_ key, a running server, an installed MCP)
curl -s -X POST "https://twinmcp.fr/api/mcp/<serverSlug>/<mcpSlug>" \
  -H "Authorization: Bearer ctx7sk_..." \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'
# then tools/list, tools/call → must return real results (not stub).
```

## 8. Operations

### Secrets & rotation
- Secrets live **only** in the Dokploy project env — never committed. A local
  `.env.production` (gitignored) is convenient but stores live secrets in
  cleartext on disk; treat any such file as compromised and inject via Dokploy.
- Stripe price IDs must be `price_...` (recurring prices), **not** `pi_...`
  (PaymentIntents) — a `pi_` value breaks Checkout for that plan.
- Rotation (any leaked/at-risk secret): roll it at the provider (Stripe key,
  Supabase DB password, Upstash token, OAuth RSA key, `CONFIG_ENCRYPTION_KEY`,
  `CLIENT_IP_ENCRYPTION_KEY`), update the Dokploy env, redeploy, then revoke the
  old value. ⚠️ Rotating `CONFIG_ENCRYPTION_KEY` invalidates stored MCP secrets —
  users must re-enter their MCP configs afterward.
- `TWINMCP_ALLOW_DEV_AUTH` must never be set in prod — the server **refuses to
  boot** if it is (`src/instrumentation.ts`), and the bypass is also disabled at
  the use site when `NODE_ENV=production`.

### Background health & metering
- **Box health reconciliation**: schedule a recurring QStash job to POST
  `{"type":"reconcile-health"}` to `${APP_URL}/api/jobs/run` (e.g. every 5 min).
  It pings each running server's box, refreshes `last_heartbeat_at`, and flips
  dead boxes to `error`. Without it, heartbeats only update when a user opens a
  server's /health.
- **MCP rate-limit / metering**: box-MCP proxy traffic is rate-limited at the
  proxy against the shared daily quota (free/pro/team); `twinmcp-docs` is
  rate-limited by its backing `/api/v2/context` (not double-counted). All proxy
  traffic is metered per MCP into `usage_metrics`.

### Monitoring
- Sentry (errors) + Axiom (latency) if configured.
- Ingestion worker (TwinMCP Docs corpus): `pnpm --filter @twinmcp/ingest worker`.
