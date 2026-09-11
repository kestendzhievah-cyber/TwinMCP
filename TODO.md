# TwinMCP — TODO & Audit (MAJ 2026-09-12)

## 🎯 État du projet

**En production** sur **twinmcp.fr** — Dokploy/VPS (conteneur Docker, **pas Vercel**), Supabase (auth + Postgres), Upstash Box (runtime MCP). Déploiement **automatique** à chaque push sur `main` (CI : `preflight → test → build → deploy → migrate → seed → smoke`). Migrations `0000→0013` appliquées, catalogue **seedé (74 MCP)**. Phases 0→7 (fondations → prod) terminées. Console admin B2B + CRM de prospection **complets** (voir « Fait » en bas).

Référence de lancement à jour : **`docs/GO-LIVE.md`** (les autres docs de plan sont historiques, voir Dette).

---

## 🔴 À activer maintenant (config prod, pas de code) — débloque des features DÉJÀ livrées

### Inscriptions / connexion (bloquant pour les nouveaux clients)

- [ ] **Supabase → Authentication → URL Configuration** : Site URL = `https://twinmcp.fr` + Redirect URLs `https://twinmcp.fr/**`. ⚠️ Tant que c'est `localhost`, les emails de confirmation pointent dans le vide → **les nouveaux comptes ne s'activent jamais**. (Connexion = **Email + mot de passe + magic link** ; Google/GitHub retirés.)

### Emails (Resend) — active digest, alertes, emails vente/upgrade

- [ ] **`RESEND_API_KEY`** (+ `EMAIL_FROM`, `SALES_EMAIL`) en env Dokploy, **domaine vérifié** chez Resend. Sans clé : tous les envois d'email sont des **no-op silencieux**.

### Digest quotidien + alertes churn (features livrées, jamais déclenchées)

- [ ] **`CRON_SECRET`** (+ `DIGEST_EMAIL` optionnel) en env Dokploy.
- [ ] **2 schedules QStash** (ou n'importe quel cron) qui font un `POST` avec l'en-tête `Authorization: Bearer <CRON_SECRET>` :
  - `https://twinmcp.fr/api/cron/digest` — ex. `0 7 * * *`
  - `https://twinmcp.fr/api/cron/churn` — ex. `0 8 * * *`
  - ⚠️ Sans ça ils **ne se déclenchent jamais**. Le bouton « M'envoyer le digest » du cockpit marche déjà (dès que Resend est posé).

### Auto-rescue des serveurs bloqués (fiabilité)

- [ ] **Schedule QStash `reconcile-health`** (~toutes les 5 min) : `POST ${APP_URL}/api/jobs/run` avec `{"type":"reconcile-health"}` → débloque les box coincées en `provisioning`. Alternative : `RECONCILE_HEALTH_INTERVAL_MS` en env (single-container uniquement).

### WhatsApp prospection (feature livrée)

- [ ] **`WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`** en env + **template Meta `prospection_intro` approuvé**. Guide pas-à-pas : **`docs/WHATSAPP-SETUP.md`**. Sans ça, l'envoi renvoie « WhatsApp non configuré ».

### Sécurité / divers prod

- [ ] **`CORS_ORIGIN`** = `https://twinmcp.fr` (sinon fallback `*`).
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** (optionnel) — suppression complète de compte (RGPD : efface aussi l'identité Supabase).
- [ ] Vérifier les **clés Stripe LIVE** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID` (+ yearly/team optionnels). ⚠️ ce sont des IDs `price_…`, **pas** `pi_…`.

---

## 🟡 Dette technique / doc

- [ ] **Documenter les env manquantes** dans `.env.example` **et** `scripts/check-env.ts` (utilisés dans le code mais absents des deux) : `CRON_SECRET`, `DIGEST_EMAIL`, `WHATSAPP_*`, `RATE_LIMIT_FREE/PRO/TEAM_DAILY`.
- [ ] Marquer **historiques/obsolètes** : `rules/Back-end.md` (parle de Vercel/Railway/Neon/Clerk) et `docs/PROMPT-LANCEMENT.md` (demande de réécrire des docs déjà réécrites).

---

## 🧪 Tests (dette) — 13 fichiers, gros angles morts

- [ ] **Console admin non testée** : `api/v2/admin/prospects/**`, `.../clients/**`, `attention`, `catalog`, crons `digest`/`churn`, `lib/admin/**` (attention, health, digest-email, onboard, prospects-lib), `lib/whatsapp.ts`.
- [ ] **Provisioning / health / queue** non testés : `lib/provisioning.ts`, `lib/health.ts`, `lib/queue/qstash.ts`.
- [ ] **Proxy MCP** (`api/mcp/[serverSlug]/[mcpSlug]`) — cœur du produit, **aucun test unitaire** (juste `scripts/smoke-mcp.ts`).
- [ ] **Webhook Stripe** (`api/webhooks/stripe`) non testé (seul le mapping de prix l'est).

---

## 🌐 Marketing / SEO / i18n

- [ ] **Home FR incomplète** vs EN : il manque `MarketplacePreview`, `SocialProof`, la barre de logos IDE, et l'event analytics `landing_view` (→ les visites FR **ne sont pas trackées** dans le funnel).
- [ ] **Bug prix en `$`** sur la page FR → mettre en **€**.
- [ ] **Page entreprise FR orpheline** : `/fr/entreprises` existe mais l'EN est `/enterprise` (slugs différents) et `/enterprise` n'est pas dans l'allow-list `FR_AVAILABLE_EXACT` (`lib/i18n/locales.ts`) → le sélecteur de langue n'y mène jamais. Aligner slug + allow-list.
- [ ] **9 articles de blog EN sans version FR** (3 traduits seulement).
- [ ] **Démo = placeholder** (`components/marketing/demo-modal.tsx` « Demo coming soon ») → vraie démo ou retirer le CTA.

---

## 🚀 Roadmap produit

### Automatisations prospection/clients (suite logique de la session)

- [ ] **Séquences de relance auto** (cadences email/WhatsApp planifiées via QStash) — le plus gros levier.
- [ ] **Scoring de leads** (fit France 2030 : taille/secteur/valeur → tri auto du pipeline). Aucune dépendance.
- [ ] **Invitation auto au « Gagné » sans compte** (email magic-link) — comble le seul trou de l'auto-onboarding.
- [ ] **Rédaction IA du 1er message** (perso depuis le site/secteur) — nécessite une clé Anthropic serveur.
- [ ] **Import entrant de leads** (endpoint protégé par clé API : LinkedIn/Zapier/formulaires → prospects).

### Plateforme

- [ ] **Facturation B2B** (facture entreprise + relance des impayés) — nécessite Stripe.
- [ ] **OAuth 2.1 MCP** (code prêt, désactivé) : persister les stores en Drizzle, accepter le JWT dans `authenticateRequest`, ajouter `.well-known/oauth-protected-resource`, puis `OAUTH_ENABLED=1`.
- [ ] **Élargir le catalogue** : chemin `uv`/`uvx`/docker-exec dans la box pour les MCP Python/Go (aujourd'hui surtout Node/npx).
- [ ] **Self-hosting** (roadmap ; orchestration couplée à Upstash Box aujourd'hui).
- [ ] **Pages secteur** (`/fr/entreprises/industrie`, `/retail`…) pour campagnes ciblées + SEO.
- [ ] **Registre créateurs / promos** : aujourd'hui un stub (`lib/promos/creators.ts`, `@youtuber`) — `/p/*` 404 tant que `STRIPE_PROMO_YOUTUBER_ID` n'est pas posé.

---

## ✅ Fait (récap)

### Plateforme & infra

- [x] Prod live **twinmcp.fr** (Dokploy/VPS), déploiement auto push→`main`.
- [x] Secrets déploiement (`VPS_*`) + **`DATABASE_URL_UNPOOLED`** posés → CI migrate+seed automatiques.
- [x] CI durci : garde **`preflight`** (aucun deploy sans le secret DB).
- [x] Migrations **0000→0013** appliquées ; catalogue **seedé (74 MCP)**.
- [x] Runtime MCP prouvé E2E (Upstash Box → supergateway → proxy Streamable-HTTP).
- [x] Optimisations perf backend (pool DB réel, caches mémoire, index analytics, dynamic imports).
- [x] Extensions `vector` + `pg_trgm` ; Sentry/Axiom/CSP/CORS/HSTS/RGPD (Phase 6).

### Auth & billing

- [x] Auth Supabase (**Email + mot de passe + magic link**). **Google/GitHub retirés.**
- [x] Billing Stripe (checkout, portal, webhooks) + infra emails Resend.

### CRM de prospection (admin only)

- [x] Pipeline **Liste / Kanban / Analytics** (KPIs, entonnoir de conversion, pipeline pondéré).
- [x] Formulaire démo `/fr/entreprises` → prospect ; badge « Inscrit » (lien CRM↔compte).
- [x] **Import/Export CSV**, **4 templates email**, **timeline** par prospect.
- [x] **WhatsApp** (Meta Cloud API) : envoi de template personnalisé + log timeline.

### Console admin B2B (clients)

- [x] **Monitoring par client** (`/dashboard/admin/clients` + fiche détaillée : serveurs, MCPs, usage, clés, audit, Stripe).
- [x] **Provisioning pour un client** (créer serveur, installer MCP) + **bundles MCP** en 1 clic.
- [x] **Cycle de vie** : arrêter / démarrer / supprimer un serveur, désinstaller un MCP.

### Automatisations (livrées cette session)

- [x] **Cockpit « À traiter »** (+ badge de compteur dans la nav).
- [x] **Digest quotidien** par email (endpoint `/api/cron/digest` + bouton manuel).
- [x] **Auto-onboarding au « Gagné »** (box « Production » + pack Essentiel provisionnés auto).
- [x] **Score de santé client + alertes churn** (cockpit + digest + `/api/cron/churn`, anti-spam 7 j via audit).
