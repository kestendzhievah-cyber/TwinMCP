Vue d'ensemble                                                                                                                                                                   
                                                                                                                                                                                     6 composants à construire :                                                                                                                                                        1. API Backend (endpoints MCP)                                                                                                                                                   
  2. Base de données (Postgres + pgvector)                                                                                                                                         
  3. Pipeline d'ingestion (docs → embeddings)
  4. Auth (OAuth + API keys)
  5. Dashboard (Next.js)
  6. Billing (Stripe) + déploiement

  Stack recommandée : Next.js 15 (App Router) monolithe — front + API + admin dans un seul repo. Postgres (Neon/Supabase) + pgvector. Clerk pour l'auth. Stripe pour le billing.   
  Vercel + Railway (workers) pour le déploiement.

  Durée estimée : 8–12 semaines à temps plein pour une V1 propre.

  ---
  Phase 0 — Fondations (semaine 1)

  Objectif : setup monorepo, CI, environnements.

  - Ajouter apps/backend (Next.js 15) dans le monorepo pnpm existant.
  - Provisionner : Neon Postgres (dev + prod), bucket S3/R2 (stockage raw docs), Upstash Redis (rate limiting + cache).
  - Créer comptes : Clerk, Stripe (mode test), Cloudflare (DNS + Workers éventuels).
  - Setup .env.example + GitHub Actions (lint, typecheck, test, deploy preview).
  - Configurer DNS : twinmcp.com, api.twinmcp.com, mcp.twinmcp.com, clerk.twinmcp.com.

  Livrable : monorepo qui build et déploie une page vide sur twinmcp.com.

  ---
  Phase 1 — Schéma DB + API endpoints (semaines 2–3)

  Schéma Postgres (Drizzle ORM)

  users              -- id (Clerk user_id), email, plan, quota_used, created_at
  api_keys           -- id, user_id, key_hash, prefix (ctx7sk), last_used_at, revoked_at
  teamspaces         -- id, owner_id, name, plan
  teamspace_filters  -- teamspace_id, min_trust_score, blocked_library_ids[]
  libraries          -- id (ex: /vercel/next.js), title, description, repo_url,
                       trust_score, benchmark_score, total_snippets, versions[],
                       source_url, last_indexed_at, status
  documents          -- id, library_id, version, path, raw_content, updated_at
  chunks             -- id, document_id, content, token_count, embedding vector(1536),
                       position, metadata jsonb
  usage_events       -- user_id, endpoint, timestamp, library_id, latency_ms

  Index critiques : chunks.embedding (HNSW), libraries.title (GIN trigram), api_keys.key_hash (unique).

  Endpoints à implémenter

  - GET /api/v2/libs/search — full-text + vecteur sur libraries
  - GET /api/v2/context — vecteur dans chunks filtré par library_id, rerank, concat texte
  - POST /api/v2/auth/keys — créer clé API
  - DELETE /api/v2/auth/keys/:id
  - GET /api/v2/usage — stats utilisateur
  - OAuth 2.1 : /.well-known/oauth-authorization-server, /authorize, /token (requis pour MCP HTTP transport)

  Middleware

  - Auth : Clerk pour sessions web, API key pour MCP (lookup key_hash)
  - Rate limiting : Upstash Redis par user_id selon plan (free: 50/j, pro: 1000/j)
  - Logging : chaque appel → usage_events

  Livrable : backend répond correctement aux appels du MCP existant (tests packages/mcp/test/*).

  ---
  Phase 2 — Ingestion pipeline (semaines 4–5)

  Objectif : remplir la base avec des docs réelles.

  Worker Node (séparé, sur Railway)

  1. Source : liste manuelle de repos GitHub (commence par 50 libs populaires : React, Next.js, Vue, Django, FastAPI, etc.)
  2. Scraping : clone repo → extract README.md, docs/**/*.md, *.mdx, JSDoc
  3. Chunking : découpe ~500 tokens avec overlap 50, garde titres Markdown en metadata
  4. Embeddings : OpenAI text-embedding-3-small (1536 dim, 0.02$/1M tokens) ou bge-large local
  5. Trust score : GitHub stars + age + last commit + #contributors → normalisé 0–10
  6. Snippets code : extraction blocs ```lang des markdown → count
  7. Scheduler : BullMQ + cron, réindexation hebdo par lib

  Commande admin

  pnpm tsx scripts/ingest.ts --repo vercel/next.js

  Livrable : 50 bibliothèques indexées, recherche et contexte renvoient des résultats pertinents.

  ---
  Phase 3 — Auth + OAuth MCP (semaine 6)

  MCP HTTP transport exige OAuth 2.1 (RFC).

  1. Clerk pour signup/login web (GitHub/Google/email).
  2. Flow API key : dashboard génère clé ctx7sk_<32hex> → hash SHA-256 en DB.
  3. OAuth server pour MCP : implémente /.well-known/oauth-authorization-server, /register (DCR), /authorize, /token — utilise oauth4webapi ou @panva/oauth4webapi.
  4. Adapte packages/mcp/src/lib/encryption.ts : headers déjà OK.
  5. Ton RESOURCE_URL=https://mcp.twinmcp.com doit servir le MCP streaming HTTP derrière l'auth.

  Livrable : Claude Desktop / Cursor peuvent s'authentifier à mcp.twinmcp.com et appeler les outils.

  ---
  Phase 4 — Dashboard (semaines 7–8)

  Next.js App Router, shadcn/ui, Tailwind.

  Pages :
  - /dashboard — clés API, usage, quota
  - /dashboard/libraries — browse + search libs indexées
  - /dashboard/policies — teamspace filters (trust score min, blocklist) — cité dans utils.ts:75
  - /dashboard/billing — plan actuel, facture, upgrade
  - /dashboard/team — inviter membres (teamspaces)
  - /plans — page pricing publique

  Livrable : utilisateur peut signup, créer une clé, voir son usage, et pointer un client MCP dessus.

  ---
  Phase 5 — Billing + quotas (semaine 9)

  1. Stripe Checkout + Billing Portal (Pro 20$/mois, Team 50$/mois).
  2. Webhooks Stripe → update users.plan.
  3. Quotas dynamiques par plan dans le middleware.
  4. Page 429 avec lien twinmcp.com/plans (déjà référencé dans api.ts:28).
  5. Email transactionnel (Resend) : signup, quota 80%, upgrade.

  Livrable : flow payant end-to-end testable en mode Stripe test.

  ---
  Phase 6 — Observabilité + sécurité (semaine 10)

  - Logs structurés : Axiom ou Better Stack
  - Monitoring : Sentry (front + back)
  - Métriques : latence p95 par endpoint, taux d'erreur, coût OpenAI
  - Sécurité : CSP, CORS stricts, rotation clé CLIENT_IP_ENCRYPTION_KEY, secrets dans Vercel/Railway, audit pnpm audit
  - Tests : unit (vitest), integration (supertest), E2E (Playwright) sur dashboard
  - Penser RGPD : politique confidentialité, suppression compte

  ---
  Phase 7 — Production + lancement (semaines 11–12)

  1. Migration DB finale, backups automatiques (Neon point-in-time).
  2. Load test : k6 sur /api/v2/context (objectif : 100 rps, p95 < 500ms).
  3. Documentation utilisateur : garde docs/ existant, adapte screenshots.
  4. Status page : BetterStack ou Instatus sur status.twinmcp.com.
  5. Publier les packages npm renommés : @twinmcp/mcp, @twinmcp/cli, @twinmcp/sdk.
  6. Lancement beta privée (50 users) → public.

  ---
  Budget mensuel estimé (V1, 1000 users actifs)

  ┌─────────────────────────────┬────────────┐
  │            Poste            │    Coût    │
  ├─────────────────────────────┼────────────┤
  │ Neon Postgres (Scale)       │ ~70$       │
  ├─────────────────────────────┼────────────┤
  │ Vercel (Pro)                │ 20$        │
  ├─────────────────────────────┼────────────┤
  │ Railway (workers ingestion) │ ~20$       │
  ├─────────────────────────────┼────────────┤
  │ Upstash Redis               │ ~10$       │
  ├─────────────────────────────┼────────────┤
  │ Clerk (Pro)                 │ 25$        │
  ├─────────────────────────────┼────────────┤
  │ OpenAI embeddings + rerank  │ ~50$       │
  ├─────────────────────────────┼────────────┤
  │ R2 storage                  │ ~5$        │
  ├─────────────────────────────┼────────────┤
  │ Monitoring (Sentry, Axiom)  │ ~30$       │
  ├─────────────────────────────┼────────────┤
  │ Total                       │ ~230$/mois │
  └─────────────────────────────┴────────────┘

  ---
  Ordre d'exécution recommandé

  Je te suggère de ne pas faire tout en séquentiel strict. Parallélise :
  - Solo dev : Phases 0→1→2→3→4→5→6→7 (3 mois)
  - 2 devs : back (0→1→2→3→5→6) + front (4→7) en parallèle (~2 mois)

  Prochaine étape immédiate

  Dis-moi lequel tu veux que je démarre maintenant, je scaffold le code :
  1. apps/backend Next.js + schéma Drizzle + migrations
  2. Script d'ingestion standalone (le plus concret, résultat visible vite)
  3. Endpoints /api/v2/* stubs avec mocks pour débloquer le MCP
  4. Config Clerk + OAuth MCP (le plus technique)