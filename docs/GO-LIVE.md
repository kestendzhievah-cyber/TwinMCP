# TwinMCP — Go-live checklist

Operational steps to launch on a self-hosted VPS (Docker / Dokploy). All code for
épopées 1–9 is merged on `feat/plan-gating-and-conversion`; what remains here is
configuration + verification that needs real credentials. Domain: `twinmcp.fr`
(replace with yours). See also `PRODUCTION.md`, `PROVISIONING.md`,
`docs/adr/0001-mcp-runtime.md`.

## 1. Database (after each deploy)

`db:migrate` runs automatically in CI and applies, in order:
- `0000_init_extensions.sql` (`vector`, `pg_trgm`) — now run by `migrate.ts` before the migrator
- migrations through **0005** (per-MCP endpoints) and **0006** (usage_metrics unique index)

Then seed/refresh the catalog once (idempotent upsert + unpublishes deprecated entries):

```bash
pnpm --filter @twinmcp/backend seed:mcps
```

## 2. Dokploy environment

`NEXT_PUBLIC_*` must be set as **build args** (compose forwards them); everything
else is runtime. Validate with `pnpm --filter @twinmcp/backend check-env`.

### Required for the core feature
| Var | Why |
|---|---|
| `UPSTASH_BOX_API_KEY` | **Blocking** — provisioning refuses to run in prod without it (no stub mode). |
| `CONFIG_ENCRYPTION_KEY` | `openssl rand -hex 32` — AES-256-GCM for MCP secrets. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Boot + client bundle (build args). |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Postgres (pooled runtime / direct migrations). |

### Auth & security
| Var | Why |
|---|---|
| `CORS_ORIGIN=https://twinmcp.fr` | No `*` fallback in prod. |
| `TWINMCP_ALLOW_DEV_AUTH` | Must be **absent**/`0` — the server refuses to boot otherwise. |
| `CLIENT_IP_ENCRYPTION_KEY` | `openssl rand -hex 32`. |
| `OAUTH_ENABLED` | Leave unset — auth is by `ctx7sk_` API key. Only enable once OAuth stores are DB-backed. |

### Billing (Stripe)
| Var | Why |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Live keys. |
| `STRIPE_PRO_MONTHLY_PRICE_ID` (+ yearly/Team) | **`price_…`, not `pi_…`** — a `pi_` value breaks Checkout. |

Webhook endpoint: `https://twinmcp.fr/api/webhooks/stripe` listening to
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`.

### Queue (recommended — durable provisioning + retries)
`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `APP_URL=https://twinmcp.fr`.
Without these, jobs run inline in-process (OK on the long-lived container, but no retries / lost on restart).

### Other build-arg `NEXT_PUBLIC_*`
`NEXT_PUBLIC_SITE_URL`, and (optional) `NEXT_PUBLIC_POSTHOG_KEY/HOST`, `NEXT_PUBLIC_SENTRY_DSN`.

## 3. GitHub Actions (CI/CD)

- **Variable:** `BASE_URL = https://twinmcp.fr` (used by the smoke test).
- **Secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (opt), `DATABASE_URL_UNPOOLED`.

## 4. Schedule the box-health reconciliation

Create a recurring **QStash schedule** (e.g. every 5 min) that POSTs a signed request:

```
POST https://twinmcp.fr/api/jobs/run
body: {"type":"reconcile-health"}
```

It pings each running box, refreshes `last_heartbeat_at`, and flips dead boxes to `error`.

## 5. Secret hygiene

- Inject secrets only via Dokploy — never commit them.
- A local `.env.production` holds live secrets in cleartext: treat as compromised,
  **rotate** (Stripe key, Supabase DB password, Upstash token, OAuth RSA key,
  encryption keys), and fix any `pi_…` Stripe IDs to `price_…`.
- Rotating `CONFIG_ENCRYPTION_KEY` invalidates stored MCP secrets (users re-enter configs).

## 6. End-to-end smoke test (the launch gate)

With a real `UPSTASH_BOX_API_KEY` set:

```bash
# health
curl -fsS https://twinmcp.fr/api/health

# 1) sign up, 2) create a server, 3) install the `filesystem` MCP,
# 4) mint a ctx7sk_ key, then handshake through the proxy:
curl -s -X POST "https://twinmcp.fr/api/mcp/<serverSlug>/filesystem" \
  -H "Authorization: Bearer ctx7sk_..." \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'
# then tools/list, tools/call → must return real results (not stub).
```

Also verify: signup → checkout → webhook → `users.plan` updated; downgrade stops
over-quota servers.

## 7. Known follow-ups (non-blocking)

- **FR UI i18n** — deferred, needs an i18n layer (next-intl). See `docs/adr/0002-ui-language.md`.
- **Catalog breadth** — github/postgres/official-fetch MCPs need a uv/uvx or docker
  exec path in the box (Python/Go/Docker-only); only Node/npx servers ship today.
- **OAuth 2.1** — code exists but disabled; to enable, persist its stores in Drizzle,
  accept the JWT in `authenticateRequest`, add `.well-known/oauth-protected-resource`,
  then set `OAUTH_ENABLED=1`.
