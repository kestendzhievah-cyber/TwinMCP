# TwinMCP — Production Launch Checklist

## Pre-launch

### Infrastructure
- [ ] Supabase project upgraded (PITR backups enabled)
- [ ] Upstash Redis provisioned (rate limiting + BullMQ)
- [ ] Cloudflare R2 bucket created (`twinmcp-docs`)
- [ ] Domain `twinmcp.com` configured (DNS records per `PROVISIONING.md`)

### Auth
- [ ] Supabase Auth providers active: Email, GitHub, Google
- [ ] OAuth JWT keys generated and in Vercel env vars
- [ ] `CORS_ORIGIN` set to `https://twinmcp.com` (not `*`)

### Billing
- [ ] Stripe products created: Pro ($20/mo), Team ($50/mo)
- [ ] Stripe webhook endpoint: `https://twinmcp.com/api/webhooks/stripe`
- [ ] Stripe events listened: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`
- [ ] Stripe Billing Portal configured (branding, cancellation flows)
- [ ] Test end-to-end: signup → checkout → plan upgrade → webhook fires → DB updated

### Monitoring
- [ ] Sentry project created, `SENTRY_DSN` in Vercel env vars
- [ ] Axiom dataset `twinmcp`, `AXIOM_TOKEN` in Vercel env vars
- [ ] Resend domain verified, `RESEND_API_KEY` in env vars

### Deployment
- [ ] Vercel project linked: root directory `.`, framework `Next.js`
- [ ] Build command: `pnpm --filter @twinmcp/backend build`
- [ ] All env vars from `.env.example` set in Vercel project settings
- [ ] GitHub secrets set: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_UNPOOLED`
- [ ] Deploy preview working on PRs
- [ ] Production deploy on merge to `main`

### Security
- [ ] `CLIENT_IP_ENCRYPTION_KEY` generated and set
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] Review CSP headers (no `unsafe-eval` in prod if possible)
- [ ] `pnpm audit` clean

### Data
- [ ] Seed test data: `npx tsx scripts/seed-test-data.ts`
- [ ] Ingest first libraries: `pnpm --filter @twinmcp/ingest ingest -- --all --limit 10`
- [ ] Verify search + context endpoints return data

## Launch

### Load test
```bash
# Install k6: https://k6.io/docs/get-started/installation/
K6_BASE_URL=https://twinmcp.com K6_API_KEY=ctx7sk_... k6 run apps/backend/scripts/load-test.js
```
Target: 100 rps, p95 < 500ms, error rate < 5%.

### Beta (50 users)
- [ ] Status page live at `status.twinmcp.com` (BetterStack / Instatus)
- [ ] Invite beta users, collect feedback
- [ ] Monitor Sentry for errors, Axiom for latency

### Public launch
- [ ] Remove "Phase 0" text from landing page
- [ ] Update `README.md` with production URLs
- [ ] Publish npm packages: `@twinmcp/mcp`, `@twinmcp/cli`, `@twinmcp/sdk`
- [ ] Update `server.json` + `gemini-extension.json` with production MCP URL
- [ ] Announce

## Post-launch
- [ ] BullMQ worker running on Railway (`pnpm --filter @twinmcp/ingest worker`)
- [ ] Weekly reindex scheduled (`pnpm --filter @twinmcp/ingest seed`)
- [ ] Monitor daily: Sentry errors, Axiom p95, Stripe MRR, usage growth
