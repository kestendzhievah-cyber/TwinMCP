# TwinMCP — Provisioning checklist (Phase 0)

This is the manual setup you must complete before Phase 1. Each step ends with the env vars it produces — copy them into `.env.local` (dev) and into Vercel / Railway project settings (prod).

## 1. Domain & DNS — Cloudflare

1. Buy `twinmcp.com` (or use an existing domain) and point nameservers to Cloudflare.
2. Create these DNS records (proxied = OFF for Vercel apex, ON for API workers if used):
   - `twinmcp.com` → Vercel (A/ALIAS)
   - `www.twinmcp.com` → Vercel
   - `api.twinmcp.com` → Vercel (same app, or dedicated)
   - `mcp.twinmcp.com` → backend (serves MCP streaming HTTP)
   - `auth.twinmcp.com` → Firebase Hosting (optional custom auth domain)
   - `status.twinmcp.com` → BetterStack/Instatus (later)
3. Verify SSL propagation: <https://dnschecker.org>.

## 2. Postgres — Supabase

1. Create two Supabase projects: `twinmcp-dev`, `twinmcp-prod` (or use an existing one and namespace via schemas).
2. Enable extensions in Dashboard → Database → Extensions:
   - `vector` (pgvector)
   - `pg_trgm`
3. Get connection strings in Settings → Database → Connection string:
   - **Transaction pooler** (port 6543, PgBouncer) → runtime serverless → `DATABASE_URL`
   - **Direct connection** (port 5432) → migrations → `DATABASE_URL_UNPOOLED`
4. Append `?sslmode=require` to both. For the pooler URL also add `&pgbouncer=true&connection_limit=1`.
5. (Optional) Copy the anon/service role keys if you plan to use Supabase Storage or RLS from the client later — not required for this backend.

→ `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optional)

## 3. Redis — Upstash

1. Create a Redis database (region: same as Vercel deployment).
2. Copy REST URL + token.

→ `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## 4. Object storage — Cloudflare R2

1. Enable R2 in Cloudflare dashboard.
2. Create bucket `twinmcp-docs`.
3. Create API token with read/write scope.
4. Enable public access (for non-sensitive artifacts) → note public URL.

→ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`

## 5. Auth — Firebase

1. Create a Firebase project "TwinMCP" in <https://console.firebase.google.com>.
2. Build → Authentication → Get started. Enable providers: GitHub, Google, Email/Password.
3. Authorized domains: add `twinmcp.com`, `www.twinmcp.com`, `localhost`.
4. Project settings → General → "Your apps" → register a **Web app**. Copy the config object → fill the `NEXT_PUBLIC_FIREBASE_*` vars below.
5. Project settings → Service accounts → Generate new private key (JSON). Extract `project_id`, `client_email`, `private_key` for the Admin SDK on the backend. Keep the JSON file out of git.
6. (Optional, recommended) Use Firebase Hosting custom domain `auth.twinmcp.com` for the sign-in handler, or stick with the default `<project>.firebaseapp.com`.

→ Client (public): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
→ Server (secret): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escape newlines as `\n`)

## 6. Billing — Stripe

1. Create Stripe account, enable test mode.
2. Create products: `Pro` ($20/mo) and `Team` ($50/mo). Copy price IDs.
3. Install Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

→ `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`

## 7. AI — OpenAI

1. Create API key with embeddings + chat scope.
2. Set monthly hard limit ($100 initially).

→ `OPENAI_API_KEY`

## 8. Email — Resend

1. Create Resend account, verify `twinmcp.com` (add DKIM records in Cloudflare).
2. Create API key.

→ `RESEND_API_KEY`, `EMAIL_FROM`

## 9. Monitoring — Sentry + Axiom

1. Create Sentry project (Next.js).
2. Create Axiom dataset `twinmcp`.

→ `SENTRY_DSN`, `AXIOM_TOKEN`, `AXIOM_DATASET`

## 10. Deploy — Vercel + Railway

### Vercel (frontend + API)

1. Import the repo (monorepo, root `apps/backend`).
2. Framework preset: Next.js. Install command: `pnpm install`. Build: `pnpm --filter @twinmcp/backend build`.
3. Attach `twinmcp.com` + `api.twinmcp.com` + `mcp.twinmcp.com`.
4. Paste all env vars from `.env.example`.

### Railway (workers — Phase 2)

1. New project "twinmcp-workers".
2. Deploy service from `apps/ingest` (created in Phase 2).
3. Attach same env vars (DB, Redis, R2, OpenAI).

### Firebase Admin key (local dev)

When pasting `FIREBASE_PRIVATE_KEY` in `.env.local`, wrap in double quotes and keep `\n` literal:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n"
```

The backend helper calls `privateKey.replace(/\\n/g, "\n")` before use.

## 11. Generate secrets

```bash
# AES-256 key for client IP encryption (64 hex chars)
openssl rand -hex 32

# RSA key pair for OAuth JWT signing
openssl genrsa -out oauth-private.pem 2048
openssl rsa -in oauth-private.pem -pubout -out oauth-public.pem
```

→ `CLIENT_IP_ENCRYPTION_KEY`, `OAUTH_JWT_PRIVATE_KEY`, `OAUTH_JWT_PUBLIC_KEY`

## 12. GitHub repository

1. Add secrets in Settings → Secrets → Actions:
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - `DATABASE_URL` (for migration jobs)
2. Create protected branch `main` (required CI checks).

---

## Checklist de validation Phase 0

- [ ] `pnpm install` passe à la racine
- [ ] `pnpm --filter @twinmcp/backend dev` démarre sur <http://localhost:3000>
- [ ] `curl http://localhost:3000/api/health` renvoie `{"status":"ok",...}`
- [ ] GitHub Actions verts sur un PR test
- [ ] `twinmcp.com` résout vers la page d'accueil Next.js déployée
- [ ] Tous les env vars ci-dessus présents dans Vercel project settings
