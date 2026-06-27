# TwinMCP — Provisioning checklist

Manual setup to obtain every value in `.env.example`. Each step ends with the
env vars it produces. Put them in `apps/backend/.env.local` (dev) and in the
**Dokploy project environment** (prod). Validate with:

```bash
pnpm --filter @twinmcp/backend check-env
```

> Use **one** production domain everywhere. This guide writes `twinmcp.fr` —
> replace it with yours.

## 1. Domain & DNS

1. Point your domain at the VPS that runs the container (an `A` record to the
   VPS IP, or a Dokploy-managed domain).
2. Dokploy terminates TLS (Let's Encrypt) and reverse-proxies to the app on
   `:3000`. No separate `api.`/`mcp.` subdomains are required — the MCP proxy is
   served from the same origin at `/api/mcp/<serverSlug>/<mcpSlug>`.

→ `APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `CORS_ORIGIN`,
`OAUTH_ISSUER` (all = `https://twinmcp.fr`)

## 2. Postgres + Auth — Supabase

1. Create a Supabase project.
2. Database → Extensions: the deploy applies `vector` + `pg_trgm` automatically
   (`db:migrate` runs `0000_init_extensions.sql` first), but you can enable them
   in the dashboard too.
3. Settings → Database → Connection string:
   - **Transaction pooler** (port 6543, PgBouncer) → `DATABASE_URL`
     (append `?sslmode=require&pgbouncer=true&connection_limit=1`)
   - **Direct connection** (port 5432) → `DATABASE_URL_UNPOOLED` (migrations)
     (append `?sslmode=require`)
4. Settings → API → copy the project URL and the **publishable** key.
5. Authentication → Providers: enable Email, GitHub, Google. Add your domain +
   `http://localhost:3000` to the redirect allow-list.

→ `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 3. MCP runtime — Upstash Box

1. Create an Upstash Box API key (Developer Preview). This powers per-user MCP
   runtimes. Without it, provisioning runs in **stub mode** in dev and **refuses
   to run in production**.

→ `UPSTASH_BOX_API_KEY`

## 4. Redis + Queue — Upstash

1. Create an Upstash **Redis** database → copy REST URL + token.
2. Create an Upstash **QStash** token + signing keys (recommended for durable
   provisioning with retries — see PRODUCTION.md §Queue).

→ `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

## 5. Billing — Stripe

1. Stripe account → test mode.
2. Create the **Pro** product with a recurring **monthly** price; copy its
   `price_...` id (NOT `pi_...`). Add yearly / Team prices as needed.
3. Add a webhook endpoint `https://twinmcp.fr/api/webhooks/stripe` listening
   to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy the signing secret.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

→ `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`
(required); `STRIPE_PRO_YEARLY_PRICE_ID`, `STRIPE_TEAM_MONTHLY_PRICE_ID`,
`STRIPE_TEAM_YEARLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (optional)

## 6. AI — OpenAI

1. Create an API key (embeddings). Set a monthly hard limit.

→ `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)

## 7. Generate secrets

```bash
# Config encryption key for MCP secrets — AES-256-GCM (64 hex chars)
openssl rand -hex 32          # → CONFIG_ENCRYPTION_KEY

# Client-IP encryption key (GDPR audit trail) — 64 hex chars
openssl rand -hex 32          # → CLIENT_IP_ENCRYPTION_KEY

# RSA keypair for OAuth 2.1 JWT signing
openssl genrsa -out oauth-private.pem 2048
openssl rsa -in oauth-private.pem -pubout -out oauth-public.pem
```

→ `CONFIG_ENCRYPTION_KEY`, `CLIENT_IP_ENCRYPTION_KEY`,
`OAUTH_JWT_PRIVATE_KEY`, `OAUTH_JWT_PUBLIC_KEY`

> Keep `TWINMCP_ALLOW_DEV_AUTH` unset in production — it bypasses API-key auth.

## 8. Ingestion worker (optional, for TwinMCP Docs)

→ `GITHUB_TOKEN` (PAT, `public_repo`), `REDIS_URL` (Upstash TCP "Redis Connect")

## 9. Optional services

- **Cloudflare R2** raw-doc storage → `R2_*`
- **Resend** email → `RESEND_API_KEY`, `EMAIL_FROM`
- **Sentry/Axiom** → `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, `AXIOM_TOKEN`, `AXIOM_DATASET`
- **PostHog** funnel → `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **SEO / IndexNow** → `NEXT_PUBLIC_*_VERIFICATION`, `INDEXNOW_KEY`

## 10. GitHub repository (CI/CD)

Settings → Secrets and variables → Actions:

- **Secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (optional,
  default 22), `DATABASE_URL_UNPOOLED`
- **Variables:** `BASE_URL` = `https://twinmcp.fr` (used by the smoke test)

See [PRODUCTION.md](PRODUCTION.md) for the deploy flow.
