# TwinMCP — TODO (côté toi)

## En attente (bloquant pour le lancement)

- [x] **Activer les providers Supabase Auth** : Dashboard → Authentication → Providers → activer Email, GitHub, Google
- [x] **Générer les clés JWT OAuth** ✅ (RSA 2048 générées et ajoutées à `.env.local` — testées avec succès via jose)
- [x] **Configurer Stripe** (mode test) → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`
- [x] **Récupérer une clé OpenAI** → `OPENAI_API_KEY` (pour ingestion)
- [x] **Créer un GitHub PAT** → `GITHUB_TOKEN` (pour ingestion)
- [x] **Configurer domaine + DNS** → `twinmcp.fr`
- [x] **Déployer sur VPS via Dokploy** (PAS Vercel) : conteneur Docker (root `Dockerfile`), déploiement auto par push sur `main` (SSH via `.github/workflows/deploy.yml`, cible `/opt/twinmcp`)
- [x] **Secrets GitHub du déploiement** : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (déploiements OK)
- [ ] ⚠️ **Ajouter le secret `DATABASE_URL_UNPOOLED`** — Settings → Secrets and variables → Actions → onglet **Secrets**. NON configuré : sans lui, `db:migrate` + `seed:mcps` ne tournent pas en CI (appliqués à la main le 2026-09-06). Valeur = ligne `DATABASE_URL_UNPOOLED=` de `apps/backend/.env.local` (version **UNPOOLED**, port 5432). Depuis le durcissement CI, un push ne se déploie plus tant que ce secret est absent.
- [x] **Suivre `PRODUCTION.md`** — checklist complète avant lancement (⚠️ doc partiellement obsolète : mentionne Vercel/Neon alors que la prod est Dokploy/Supabase)

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
