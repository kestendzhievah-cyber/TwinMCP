# TwinMCP — TODO (côté toi)

## En attente (bloquant pour le lancement)

- [ ] **Activer les providers Supabase Auth** : Dashboard → Authentication → Providers → activer Email, GitHub, Google
- [x] **Générer les clés JWT OAuth** ✅ (RSA 2048 générées et ajoutées à `.env.local` — testées avec succès via jose)
- [ ] **Configurer Stripe** (mode test) → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`
- [ ] **Récupérer une clé OpenAI** → `OPENAI_API_KEY` (pour ingestion)
- [ ] **Créer un GitHub PAT** → `GITHUB_TOKEN` (pour ingestion)
- [ ] **Configurer domaine + DNS** (voir `PROVISIONING.md` §1)
- [ ] **Configurer Vercel** : importer repo, ajouter env vars, lier domaine
- [ ] **Configurer GitHub secrets** : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_UNPOOLED`
- [ ] **Suivre `PRODUCTION.md`** — checklist complète avant lancement

## Optionnel

- [ ] Upstash Redis (TCP) pour BullMQ worker
- [ ] Cloudflare R2 bucket pour stockage raw docs
- [ ] Sentry DSN + Axiom token
- [ ] Resend API key + vérification domaine
- [ ] Status page (BetterStack / Instatus)

## Terminé

- [x] Abonnement Supabase actif
- [x] `.env.local` configuré (Supabase URL + connection strings Postgres)
- [x] Extensions `vector` + `pg_trgm` activées
- [x] Migration DB appliquée — 9 tables créées
- [x] Phase 0 — Fondations (apps/backend scaffoldé)
- [x] Phase 1 — Schéma DB + endpoints API (10 routes)
- [x] Phase 2 — Pipeline d'ingestion (CLI + BullMQ worker + 50 libs seed)
- [x] Phase 3 — Auth Supabase + OAuth 2.1 MCP (sign-in, sign-up, authorize/token/register)
- [x] Phase 4 — Dashboard (API keys, libraries, policies, team, billing, plans)
- [x] Phase 5 — Billing Stripe (checkout, portal, webhooks) + emails Resend
- [x] Phase 6 — Observabilité (Sentry + Axiom) + sécurité (CSP/CORS/HSTS) + tests (22) + RGPD
- [x] Phase 7 — Production (Dockerfile, Vercel config, deploy workflow, load test k6, seed data, PRODUCTION.md)
