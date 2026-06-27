# Contexte & objectif

Tu es un agent de code senior. Ta mission : rendre **TwinMCP** « clé en main, prêt pour le lancement » sur un VPS Docker auto-hébergé.

**Produit** : TwinMCP est une plateforme SaaS multi-tenant. Chaque utilisateur provisionne **son propre serveur MCP** (un runtime isolé, une « Box » Upstash) sur lequel il installe des MCP du catalogue, puis **connecte ce serveur à un LLM / client MCP** (Claude Desktop, Cursor, Claude Code, Windsurf, Cline…) **simplement et rapidement** via le protocole MCP, avec une config copiable-collable.

**La fonctionnalité CŒUR à finaliser** : un utilisateur crée un serveur → installe au moins un MCP → un client LLM standard s'y connecte via le protocole MCP (transport Streamable HTTP + auth Bearer) → appelle un outil (`tools/list` puis `tools/call`) **avec succès, en production, sans mode stub**. Aujourd'hui cette chaîne **n'est PAS fonctionnelle de bout en bout** : seul le MCP interne `twinmcp-docs` (servi par le control plane, pas par une Box) répond réellement.

Tu travailles en **brownfield** : l'essentiel des surfaces périphériques (auth, billing, onboarding, plan gating, schéma DB, UI dashboard) **existe déjà et fonctionne**. Tu ne dois **PAS** tout réécrire. Tu corriges, câbles et fiabilises l'existant, et tu construis uniquement les maillons manquants.

Branche courante : `feat/plan-gating-and-conversion`.

---

# Stack & architecture réelle

- **Monorepo pnpm**. Control plane = `apps/backend` (Next.js 15 App Router, Drizzle ORM, Supabase Auth). Déploiement = **VPS Docker auto-hébergé via Dokploy** (PAS Vercel). Les fichiers `vercel.json`, `PRODUCTION.md`, `PROVISIONING.md` sont **obsolètes** (ils décrivent Vercel/Firebase/Railway/un produit de documentation context7) — à réécrire ou supprimer.
- **Build / déploiement** : `Dockerfile` racine (multi-stage `node:22-alpine`, `output:'standalone'`, lance `node apps/backend/server.js` sur `:3000`). `docker-compose.yml` mono-service `app` (Dokploy, healthcheck `/api/health`). CI/CD réel = `.github/workflows/deploy.yml` (push `main` → test → image GHCR → SSH vers `/opt/twinmcp` → `docker compose pull && up -d` → `db:migrate` → smoke → auto-rollback `:previous`). **Les `NEXT_PUBLIC_*` sont inlinés au build** (build args), pas seulement au runtime.

## Le triangle de tables runtime (NE PAS LES CONFONDRE)

Schéma Drizzle dans `apps/backend/src/db/schema/` (`core.ts` + `platform.ts`, barrel `index.ts`) :

- **`servers`** (`platform.ts:40`) = **le serveur MCP du user** (sa Box). Colonnes : `id`, `user_id` (FK cascade), `name`, `slug`, `host_type` (enum `hostTypes`, `platform.ts:13` : valeurs `upstash_box` | `external_url`, défaut `upstash_box` — **l'enum `external_url` existe déjà, l'option B ci-dessous est donc câblable côté schéma**), `box_id`, `box_size` (`small|medium|large`, défaut `small`), `region`, `endpoint_url`, `status` (`provisioning|running|stopped|error|destroyed`), `last_heartbeat_at`. Index unique `(user_id, slug)`. **Un seul `endpoint_url` par serveur.**
- **`mcp_servers`** (`platform.ts:66`) = **le CATALOGUE** des MCP. Colonnes : `id`, `slug` (unique), `name`, `description`, `repo_url`, `runtime` (`node|node-alpine|python|…`), `install_cmd`, `start_cmd`, `version`, `config_schema` (jsonb), `published_by_user_id`, `is_official`, `is_public`. C'est ici que vivent `runtime/install_cmd/start_cmd/config_schema`.
- **`user_servers`** (`platform.ts:93`) = **l'installation** d'un MCP du catalogue sur un serveur. Colonnes : `id`, `user_id`, `server_id` (FK cascade), `mcp_server_id` (FK restrict), `config_ciphertext` / `config_iv` / `config_tag` (config + secrets chiffrés **AES-256-GCM**), `enabled`, `installed_at`. Index unique `(server_id, mcp_server_id)`. **Ne stocke ni port ni URL par MCP installé.**

Autres tables : `api_keys` (clés AU NIVEAU COMPTE, hash SHA-256, préfixe `ctx7sk_`), `usage_metrics` (par `user_server`, **jamais alimentée**), `usage_events` (usage RAG/API context), `audit_logs` (alimentée par `logAudit()`), `processed_stripe_events` (idempotence webhooks), tables RAG (`libraries`/`documents`/`chunks` pgvector 1536d, HNSW cosine), teamspaces.

## Routes & fichiers clés (chemins réels)

- Proxy MCP (point d'entrée client→serveur) : `apps/backend/src/app/api/mcp/[serverSlug]/[mcpSlug]/route.ts`
- CRUD serveurs : `apps/backend/src/app/api/v2/servers/route.ts` + `[id]/route.ts` + `[id]/{start,stop,restart,health,logs}/route.ts`
- MCP installés : `apps/backend/src/app/api/v2/servers/[id]/mcps/route.ts` + `[userServerId]/route.ts`
- Orchestration : `apps/backend/src/lib/provisioning.ts`, `apps/backend/src/lib/upstash/box-client.ts`
- File de jobs : `apps/backend/src/lib/queue/qstash.ts` + worker `apps/backend/src/app/api/jobs/run/route.ts`
- Auth MCP : `apps/backend/src/lib/auth.ts` (`API_KEY_PREFIX = "ctx7sk_"`)
- OAuth 2.1 maison : `apps/backend/src/lib/oauth.ts` + `apps/backend/src/app/.well-known/oauth-authorization-server/route.ts` + `apps/backend/src/app/oauth/{authorize,token}/route.ts`
- Chiffrement secrets : `apps/backend/src/lib/crypto/config-encryption.ts` (`CONFIG_ENCRYPTION_KEY`, 32 octets / 64 hex)
- Plan gating (source unique) : `apps/backend/src/lib/plan-features.ts` (`PLAN_CAPABILITIES`) + `apps/backend/src/lib/quota.ts` + miroir marketing `apps/backend/src/components/pricing/pricing-data.ts`
- Rate-limit : `apps/backend/src/lib/rate-limit.ts` (free=50 / pro=1000 / team=5000 req/24h)
- Billing : `apps/backend/src/lib/stripe.ts`, `api/v2/billing/{checkout,portal}/route.ts`, `api/webhooks/stripe/route.ts`
- Onboarding (5 étapes Plan→IDE→Server→MCP→Connect) : `apps/backend/src/app/onboarding/{page.tsx,wizard.tsx}` + `apps/backend/src/components/onboarding/step-{plan,welcome,server,mcp,connect}.tsx`
- Dashboard serveur : `apps/backend/src/app/dashboard/servers/{page.tsx,create-dialog.tsx,[id]/page.tsx,[id]/controls.tsx,[id]/installed-mcps.tsx}`
- Catalogue runtime seedé : `apps/backend/scripts/seed-mcps.ts` (`pnpm seed:mcps`)
- Serveur MCP autonome (PRODUIT SÉPARÉ, ne pas confondre avec le serveur par-utilisateur) : `packages/mcp/` (serveur « TwinMCP Docs » type Context7) ; `packages/mcp/src/lib/jwt.ts` valide encore les JWT via **Clerk** (`clerk.twinmcp.com`) — vestige à réconcilier (voir Épopée 6).
- ⚠️ NE PAS toucher : `apps/backend/src/lib/servers/catalog.ts` = catalogue **SEO/marketing** découplé du runtime.
- Contrat d'env faisant autorité : `apps/backend/scripts/check-env.ts` (`pnpm check-env`). `.env.example` est **incomplet/désaligné** (voir Épopée 5 pour l'état exact, vérifié).

---

# État actuel (ce qui existe DÉJÀ — ne pas réécrire)

**Fonctionne réellement :**
- Schéma Drizzle complet + migrations `0000→0004` (dont `0000_init_extensions.sql` : `vector` + `pg_trgm`, **non listé dans `meta/_journal.json`** → à appliquer manuellement AVANT `db:migrate`).
- Auth Supabase (sign-in/up, OAuth callback) ; `auth/callback/route.ts` redirige les nouveaux comptes (`onboardingCompletedAt` null) vers `/onboarding`.
- OAuth 2.1 maison entièrement codé (DCR, authorization_code + PKCE S256, refresh, `signAccessToken`/`verifyAccessToken` RS256) — **MAIS jamais consommé** (`verifyAccessToken` importé nulle part ; stores en `Map` mémoire, perdus à chaque redéploiement Docker).
- Billing Stripe complet : Checkout (subscription, trial `TRIAL_DAYS=14`), Portal, webhook signé + idempotent (met à jour `users.plan`).
- **Plan gating** centralisé et appliqué côté serveur (403) : Free={servers:1, boxSizes:[small], apiKeys:1}, Pro={servers:25, +medium, apiKeys:5}, Team={∞, +large, apiKeys:20}. `assertServerQuota` + `isBoxSizeAllowed` sur POST/PATCH `/servers` (box-size re-vérifié au resize). **Source unique** = `plan-features.ts`.
- CRUD serveurs complet + ownership RBAC strict per-user, cycle de vie câblé (POST insère `status=provisioning` + `enqueue('provision-server')` ; stop → `destroyServerRuntime` ; start/restart → re-enqueue ; health → ping + heartbeat).
- Chiffrement AES-256-GCM des configs MCP (secrets masqués `null` en lecture API si `secret:true` dans `config_schema`).
- UI complète : `CreateServerDialog`, liste serveurs avec quota, page détail (Runtime card : box_id, endpoint, taille, heartbeat ; tabs Overview/Logs ; InstalledMcps toggle/reconfigure/uninstall), onboarding 5 étapes avec génération de snippet `mcp.json` par IDE et mint auto d'une clé API.
- `twinmcp-docs` : seul MCP **réellement fonctionnel** en JSON-RPC (`initialize`/`tools/list`/`tools/call` → wrappe `/api/v2/context`, RAG OpenAI + pgvector). Servi en interne par le proxy, **traité AVANT le check `serverStatus==='running'`** (route.ts ~ligne 70), donc il répond même serveur arrêté. À **réutiliser tel quel** comme référence du handshake.
- File QStash avec fallback inline ; worker `/api/jobs/run` refuse de tourner non signé en prod (503).
- Catalogue seedé (5 MCP) : `twinmcp-docs`, `filesystem`, `github`, `fetch`, `postgres-readonly`.

---

# Ce qu'il faut livrer

Travaille **dans l'ordre**. Les épopées 1→4 sont **BLOQUANTES pour le lancement**. Coche les critères d'acceptation un par un. Avant toute modif, **lis le fichier concerné** et son contexte.

## ÉPOPÉE 1 — Rendre le runtime MCP RÉEL (le cœur produit) [BLOQUANT]

> Aujourd'hui : `@upstash/box` n'est **NI dans `apps/backend/package.json`, NI dans `pnpm-lock.yaml`, NI installé** (vérifié). Sans `UPSTASH_BOX_API_KEY`, `getBoxClient()` retombe **silencieusement** sur `StubBoxClient` qui renvoie `https://<id>.stub.box.local`, `exec → "[stubbed]"`, `ping → true`. Le chemin « réel » (`UpstashBoxClient`, `dynamicImport("@upstash/box")`) **jetterait à l'exécution**. De plus les MCP du catalogue sont des serveurs **STDIO** (`mcp-server-filesystem`, `mcp-server-github`…) lancés en background, **sans aucun pont stdio→HTTP**.

**Décision d'architecture à TRANCHER explicitement en tête de ton implémentation** (documente le choix dans un ADR court `docs/adr/0001-mcp-runtime.md`) :

- **Option A — Upstash Box réel** : installer `@upstash/box`, remplacer le `dynamicImport` bricolé par un import normal, vérifier l'API réelle du SDK (`createBox/get/exec/execBackground/ping/tail`, exposition de port/URL publique), et déployer **dans la Box un pont HTTP** (ex. `supergateway` / `mcp-proxy`) qui lance chaque MCP stdio et l'expose en **Streamable HTTP** sur un chemin/port déterministe.
- **Option B — Runtimes sur le VPS** (recommandée à évaluer sérieusement vu que le déploiement est déjà VPS Docker) : utiliser `host_type='external_url'` (**enum déjà présent**, `platform.ts:13`) et exécuter les MCP via un sidecar/worker sur le VPS derrière un pont stdio→HTTP, sans payer Upstash Box.

Quelle que soit l'option :

1. **Pont stdio↔HTTP** : chaque MCP installé doit être joignable en **Streamable HTTP** (conforme MCP, `protocolVersion` ≥ `2024-11-05`). Réutilise un pont existant (`supergateway`/`mcp-proxy`) ou recommande `mcp-remote` côté client ; **ne réinvente pas le transport**.
2. **Câbler l'URL upstream réelle** dans `provisioning.ts` (stocker l'endpoint/port réel renvoyé) et dans le proxy `api/mcp/[serverSlug]/[mcpSlug]/route.ts` (lignes 82-84 : supprimer le commentaire « not yet wired » et l'URL devinée `${endpoint}/${mcpSlug}`).
3. **`running` UNIQUEMENT après un vrai healthcheck (corrige un bug de séquencement réel)** : aujourd'hui `provisionServer()` met `status='running'` **AVANT et indépendamment** de l'installation des MCP (`provisioning.ts:45-54`), puis installe en best-effort (`provisioning.ts:71-85`) en **avalant les erreurs** (`catch console.error`). Tu dois (a) **déplacer** le passage à `running` **APRÈS** un vrai healthcheck MCP (un `initialize` qui répond, pas un `ping → true`), et (b) **propager** les échecs d'install en `status='error'` au lieu de les avaler. Préserve la voie de rattrapage : `installMcpInBox` (`provisioning.ts:170`) diffère silencieusement l'install si le serveur n'a pas encore de `box_id`/n'est pas `running` (« deferred to next start ») ; le `start` re-enqueue `provision-server` qui **ré-installe TOUS les MCP `enabled`** — ne casse pas ce rattrapage en ajoutant les jobs de l'Épopée 3.
4. **Schéma** : si plusieurs MCP HTTP distincts doivent coexister sur une même Box, ajoute une colonne `endpoint_url`/`port`/`internal_path` **par MCP installé** sur `user_servers` (nouvelle migration Drizzle `0005_*` + `meta/_journal.json` cohérent). Marque « (à vérifier selon l'option retenue) » si l'option B mono-process rend ça inutile.
5. **Garde-fou anti-stub en prod** : `isStubMode()` ne doit **JAMAIS** être vrai en production. Ajoute un check qui **échoue au boot** (ou dégrade explicitement la création de serveur avec un message clair) si `NODE_ENV=production` et `UPSTASH_BOX_API_KEY` absent (option A). Mets à jour `check-env.ts` pour que `UPSTASH_BOX_API_KEY` soit `FAIL` (et non `optional`/`TODO`) en prod pour la feature cœur.

**Critères d'acceptation** :
- `@upstash/box` présent dans `package.json` + lockfile (option A), OU implémentation VPS réelle (option B) ; plus aucun `dynamicImport` bricolé.
- Un test d'intégration crée un serveur → provisionne → installe un MCP (≠ docs) → fait `initialize` + `tools/list` + `tools/call` via le proxy authentifié et obtient une **vraie réponse** du MCP.
- En prod, aucun endpoint `*.stub.box.local` ne peut être produit ; un serveur ne passe `running` **qu'après un `initialize` MCP réussi** ; un échec d'install met le serveur en `error` (plus jamais avalé en silence).

## ÉPOPÉE 2 — Proxy MCP conforme au transport Streamable HTTP [BLOQUANT]

> Aujourd'hui `api/mcp/[serverSlug]/[mcpSlug]/route.ts` n'expose **que `POST`**, forwarde le corps brut, sans `GET` (flux SSE serveur→client), sans `DELETE` (fin de session), sans gestion de `Mcp-Session-Id`. Les clients MCP standards négocient en SSE/Streamable HTTP → ils **échouent** pour tout sauf `twinmcp-docs`.

1. Implémente le **transport MCP Streamable HTTP complet** : handlers `GET` (stream SSE), `POST`, `DELETE`, gestion de `Mcp-Session-Id`, négociation `initialize`, `content-type` SSE.
2. Conserve le cas spécial `twinmcp-docs` (handler interne déjà fonctionnel, traité avant le check de statut).
3. **Modèle d'URL officiel v1 = UNE URL PAR MCP** : `{origin}/api/mcp/<serverSlug>/<mcpSlug>`. Le code exige un `mcpSlug` précis par requête et n'a **aucun agrégateur multi-MCP**. Pour le lancement, **rends ce modèle « une URL par MCP » 100 % cohérent partout** (onboarding, dashboard, docs — voir Épopée 4) et documente-le comme officiel. Avec ce modèle, un client connecté à une URL voit **les outils de CE MCP** via `tools/list`, pas « tous les MCP du serveur ». **(À évaluer, hors-scope v1 sauf si trivial)** : un endpoint agrégé par serveur (une seule URL exposant `tools/list` de tous les MCP installés + routage `tools/call`). Si tu ne le livres pas, **ne promets nulle part « tous les outils »** : aligne le parcours utilisateur (étape 5) et la DoD sur « les outils du MCP connecté ».
4. Renvoie un en-tête `WWW-Authenticate` sur les `401` du proxy (amorçage découverte OAuth — voir Épopée 6).

**Critères d'acceptation** :
- Un client MCP standard (mcp-remote / Claude Desktop / Cursor en mode HTTP) ouvre une session, reçoit le flux SSE, liste et appelle les outils **du MCP ciblé**.
- `GET`, `POST`, `DELETE` répondent conformément à la spec MCP Streamable HTTP.

## ÉPOPÉE 3 — Jobs de cycle de vie manquants (désinstall / désactivation / reconfig) [BLOQUANT]

> Aujourd'hui `qstash.ts` ne définit que **3 jobs** : `provision-server`, `destroy-server`, `install-mcp` (vérifié). `DELETE` et `PATCH(enabled:false)` sur `/servers/[id]/mcps/[userServerId]` **ne modifient que la ligne `user_servers`** : le process MCP **continue de tourner** dans la Box. `PATCH(config)` re-chiffre mais **ne redémarre pas** le MCP avec les nouvelles variables.

1. Ajoute les jobs `uninstall-mcp`, `disable-mcp`, `reconfigure-mcp` dans `qstash.ts` (type union + `runJob`) et la logique correspondante dans `provisioning.ts` (arrêt du process dans la Box, redémarrage avec env régénéré depuis `buildEnvPrefix`).
2. Enqueue ces jobs depuis les routes `DELETE`/`PATCH` de `api/v2/servers/[id]/mcps/[userServerId]/route.ts`.
3. **Ne casse pas** le rattrapage d'install différée décrit en Épopée 1.3 (start re-installe tous les MCP `enabled`).

**Critères d'acceptation** :
- Désinstaller / désactiver un MCP **arrête réellement** son process dans le runtime.
- Reconfigurer un MCP **redémarre** son process avec les nouvelles variables d'env.

## ÉPOPÉE 4 — UX « Connecter à votre LLM » correcte et persistante [BLOQUANT]

> Aujourd'hui (vérifié) `step-connect.tsx:127` donne au client l'URL **brute de la Box** `endpointUrl ?? https://${serverName}.mcp.twinmcp.dev` (domaine **fictif non routé**) au lieu de l'URL proxy qui marche. Le préfixe de clé affiché côté UI diverge (`tmcp_`) du réel (`ctx7sk_`). Le snippet Zed référence `@twinmcp/proxy` (`step-connect.tsx:72`) **package inexistant**. « Test connection » ne fait qu'un `/health` (ping Box), pas un vrai handshake. Et **aucune affordance « copier la config / l'URL » n'existe hors onboarding** (la page détail serveur n'a aucun bouton copier ; `installed-mcps.tsx` mentionne `/api/mcp/{serverSlug}/<slug>` en texte sans bouton).

1. **Source unique de vérité de l'URL** : tous les snippets doivent pointer vers `{origin}/api/mcp/{serverSlug}/{mcpSlug}` (l'URL proxy authentifiée). Supprime le fallback `*.mcp.twinmcp.dev` et l'usage de `endpointUrl` brut. Passe `serverSlug` (déjà en DB) jusqu'au composant.
2. **Extrais** la génération de config IDE (actuellement inline dans `step-connect.tsx`) dans un module partagé `apps/backend/src/lib/mcp/client-config.ts`, réutilisé par l'onboarding ET le dashboard.
3. **Section « Connect » persistante** sur `dashboard/servers/[id]/page.tsx` (nouveau composant client) : sélecteur d'IDE, URL de connexion affichée, bloc `mcp.json` par IDE, boutons **Copier** (`navigator.clipboard`) pour l'URL et le bloc, bouton **Générer/Rotater une clé API**.
4. Corrige le préfixe affiché (`ctx7sk_`) partout, et **résous** le cas Zed : crée le package `@twinmcp/proxy`, OU remplace par `mcp-remote`, OU retire l'option Zed.
5. « **Test connection** » doit faire un **vrai handshake MCP** (`initialize` + `tools/list`) et non un simple `/health`.

**Critères d'acceptation** :
- L'URL copiée par l'utilisateur fonctionne telle quelle dans Cursor/Claude Code/Claude Desktop.
- La config est ré-affichable et copiable depuis le dashboard à tout moment, pas seulement en onboarding.
- Aucune référence à un package ou domaine inexistant.

## ÉPOPÉE 5 — Configuration d'environnement & déploiement turnkey [BLOQUANT]

> **État RÉEL de `.env.example` (vérifié, à ne pas mal interpréter)** : ce fichier **ne contient AUCUNE variable Firebase** — ne va pas en chercher ici (les vestiges Firebase/Vercel/context7 sont dans `PROVISIONING.md`/`PRODUCTION.md`, ciblés au point 5). Le seul reliquat est le **commentaire ligne 3** « set in Vercel / Railway dashboards ». Il utilise **DÉJÀ les bons noms de prix Stripe** (`STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` / `STRIPE_TEAM_MONTHLY_PRICE_ID` / `STRIPE_TEAM_YEARLY_PRICE_ID`, lignes 47-50) et indique déjà « They start with `price_`, not `pi_` ». Il **ne définit PAS** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (seulement référencées en commentaire ligne 34, « set above » alors qu'elles n'apparaissent nulle part). Il contient `TWINMCP_ALLOW_DEV_AUTH` (ligne 80, bypass d'auth dev) et il **omet** `CONFIG_ENCRYPTION_KEY`, `UPSTASH_BOX_API_KEY`, `QSTASH_*`, `APP_URL`.

1. **Complète/corrige `.env.example`** en te calant **STRICTEMENT** sur `apps/backend/scripts/check-env.ts` (autorité) :
   - **AJOUTE les deux vars de boot manquantes les plus critiques** : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (marquées `required_for_boot` dans `check-env.ts:62-66` ; sans elles `check-env` est `FAIL` et le serveur ne boote pas). Définis-les réellement, pas seulement en commentaire.
   - **AJOUTE** les vars lues par le code mais absentes : `CONFIG_ENCRYPTION_KEY` (documente `openssl rand -hex 32`), `UPSTASH_BOX_API_KEY`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `APP_URL`, `OAUTH_ISSUER` (si absent), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `CORS_ORIGIN`.
   - **Supprime** le commentaire Vercel/Railway (ligne 3) et tout en-tête obsolète. **Ne cherche pas de Firebase ici** (il n'y en a pas).
2. **Réconcilie le drift de noms Stripe — le drift est UNIQUEMENT dans `check-env.ts`** (vérifié) : `check-env.ts:80-81` attend `STRIPE_PRICE_PRO` (required) et `STRIPE_PRICE_TEAM` (optional), **un seul ID par plan sans cadence**, alors que `lib/stripe.ts` (`getPriceId()`) et `.env.example` gèrent **4 IDs** monthly/yearly. **N'aligne PAS `.env.example` sur les vieux noms** : c'est `check-env.ts` qu'il faut corriger pour qu'il **exige les 4 vars** (`STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID`, `STRIPE_TEAM_MONTHLY_PRICE_ID`, `STRIPE_TEAM_YEARLY_PRICE_ID`) — ou au minimum `STRIPE_PRO_MONTHLY_PRICE_ID` + `STRIPE_TEAM_MONTHLY_PRICE_ID` — pour rester cohérent avec `lib/stripe.ts`. Après cette correction, `pnpm check-env` doit redevenir vert avec le **même** jeu de noms partout.
3. **Documente/automatise la séquence DB turnkey** : appliquer `0000_init_extensions.sql` (vector + pg_trgm) **AVANT** `pnpm --filter @twinmcp/backend db:migrate`, puis `pnpm seed:mcps`. Le journal Drizzle (`meta/_journal.json`) n'inclut pas `init_extensions` → ajoute une étape de migration explicite (script idempotent) pour ne pas l'oublier au déploiement.
4. **Stratégie de file en prod** : aujourd'hui `/api/jobs/run` renvoie **503 en prod sans `QSTASH_CURRENT_SIGNING_KEY`**, et `enqueue()` retombe en inline fire-and-forget si `QSTASH_TOKEN`+`APP_URL` manquent → provisioning **non durable** (perte de job au restart, pas de retry). **Décide et documente** : soit imposer QStash (les 4 vars + `APP_URL` = URL publique du VPS) pour la durabilité/retry, soit assumer explicitement l'inline avec un worker durable dédié dans `docker-compose.yml`.
5. **Réécris `PRODUCTION.md` et `PROVISIONING.md`** (obsolètes Vercel/Firebase/context7) en une vraie doc **VPS/Dokploy** : prérequis serveur, build args `NEXT_PUBLIC_*`, injection des env runtime, DNS, migrations+seed, secrets GitHub Actions (`VPS_HOST/USER/SSH_KEY/SSH_PORT`, `DATABASE_URL_UNPOOLED`). Remplis aussi `README.md` (quasi vide) avec un quickstart et le flux « créer un serveur → installer un MCP → connecter son LLM ».
6. **Uniformise le domaine de prod** partout (corrige `deploy.yml` `BASE_URL=twinmcp.dev` et les `.env` `twinmcp.com`). **(à vérifier : le domaine de prod réel — `twinmcp.fr` d'après Dokploy)**.

**Critères d'acceptation** :
- `pnpm check-env` est vert pour un déploiement prod complet (feature cœur incluse), avec un **seul** jeu de noms Stripe cohérent entre `check-env.ts`, `.env.example` et `lib/stripe.ts`.
- `.env.example` définit réellement `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + toutes les vars lues par le code, et ne contient plus de commentaire mort.
- Un opérateur peut suivre `PRODUCTION.md` du serveur vierge jusqu'au premier serveur MCP connecté à un LLM.

## ÉPOPÉE 6 — OAuth 2.1 branché OU explicitement hors-scope [BLOQUANT-LÉGER]

> L'OAuth 2.1 est entièrement codé mais **jamais consommé** : `verifyAccessToken` n'est importé nulle part, le proxy n'accepte que `ctx7sk_`, et les stores (`authCodes/refreshTokens/clients`) sont des **`Map` mémoire** (perdus au redéploiement Docker). Les clients MCP qui font le flux OAuth (Claude Desktop, mcp-remote) obtiendraient un token **rejeté**.

Choisis et exécute **l'une** des deux voies (documente le choix) :
- **A (recommandé pour lancer vite)** : ne pas activer OAuth ; **clé API Bearer `ctx7sk_` uniquement** ; masquer les endpoints OAuth de la découverte ; documenter clairement l'auth par clé API.
- **B (OAuth complet)** : faire accepter le JWT OAuth dans `authenticateRequest` (`lib/auth.ts`) **en plus** des clés `ctx7sk_` ; **persister** les stores OAuth en DB Drizzle (supprimer les `Map`) ; ajouter `.well-known/oauth-protected-resource` (RFC 9728) + `WWW-Authenticate` sur 401.

Dans les deux cas : **réconcilie l'identité** — `packages/mcp/src/lib/jwt.ts` valide encore les JWT via **Clerk** (`clerk.twinmcp.com`), vestige Context7 incohérent avec Supabase Auth + OAuth maison RS256. Choisis une seule autorité et retire Clerk si non utilisé.

**Critères d'acceptation** :
- Une seule autorité d'auth documentée ; aucun store d'auth en mémoire en prod.
- Le client se connecte avec l'auth annoncée dans l'UI, sans token rejeté.

## ÉPOPÉE 7 — Sécurité, secrets & billing prêts pour la prod [BLOQUANT pour vendre]

1. **Secrets exposés en clair sur disque** : `.env.production` est **gitignored et NON tracké dans git** (vérifié) — il n'est donc **pas committé**, mais il **expose des secrets LIVE en clair sur le disque local** (Stripe `sk_live_`, mot de passe DB Supabase, clé privée OAuth RSA, token Upstash). **Considère-les compromis** : documente une procédure de **rotation** et exige l'injection exclusive via Dokploy. **Ne committe jamais** de secret. (Ne pars pas en chasse d'un commit fantôme : le risque est l'exposition locale, pas un leak git.)
2. **Price IDs Stripe invalides en prod** : `.env.production` contient des `pi_...` (PaymentIntents) au lieu de `price_...` pour Pro, et **aucun price ID Team** → checkout Pro/Team **cassé**. Documente le format `price_...` requis pour les 4 IDs (Pro mensuel/annuel + Team mensuel/annuel).
3. **`TWINMCP_ALLOW_DEV_AUTH` interdit en prod** : cette var (`.env.example:80`) active un bypass d'auth par header `X-TwinMCP-User-Id` en dev. Exige explicitement qu'elle soit **absente ou à `0`/`false` en prod** (sinon l'auth Bearer du proxy MCP est contournable) ; ajoute un garde-fou (échec au boot ou warning bloquant si elle est active avec `NODE_ENV=production`).
4. **CORS** : `next.config.mjs` lit `CORS_ORIGIN` jamais défini → retombe sur `*`. Fixe-le sur l'origine prod.
5. **Réconciliation au downgrade** : quand le webhook repasse `plan=free` (`past_due`/`unpaid`/`deleted`), rien ne stoppe les serveurs au-delà du quota Free=1 ni ne révoque les box-sizes hors-plan. Ajoute cette réconciliation + notification utilisateur.
6. **Renseigne `currentPeriodEnd`/`cancelAtPeriodEnd` dès `checkout.session.completed`** (aujourd'hui seul `subscription.updated` les écrit → UI billing incorrecte juste après l'achat).

**Critères d'acceptation** :
- Aucun secret en clair dans le repo ; rotation documentée ; `TWINMCP_ALLOW_DEV_AUTH` impossible à activer en prod.
- Checkout Pro **et** Team fonctionnel en prod avec des `price_...` valides.
- Un downgrade applique réellement le quota.

## ÉPOPÉE 8 — Métering, rate-limit MCP & observabilité [IMPORTANT, non bloquant]

1. Branche `checkRateLimit` (`lib/rate-limit.ts`) **et** le comptage d'usage sur le **proxy MCP** (aujourd'hui rate-limité uniquement sur `/v2/libs/search` et `/v2/context`). Les quotas affichés (free=50 / pro=1000 / team=5000 req/jour) doivent s'appliquer au **trafic MCP réel**. **Décide explicitement le périmètre** : le rate-limit/métering s'applique-t-il aussi à `twinmcp-docs` (servi par le control plane, pas par une Box) ? Documente la réponse.
2. Alimente `usage_metrics` (request_count/tokens_used/errors_count par `user_server`) depuis le proxy (aujourd'hui **jamais écrite**). **Attention architecture** : `usage_metrics.user_server_id` est une FK vers `user_servers` ; `twinmcp-docs` n'a pas forcément de ligne `user_servers` côté Box. **Gère explicitement le cas `docs`** (soit une ligne `user_servers` dédiée, soit un métering séparé via `usage_events`), sans casser la FK.
3. **Healthcheck réel par MCP** : vérifie que le process répond à un `initialize` MCP (pas juste `ping → true`). Ajoute une **réconciliation de fond** (cron) détectant les Box mortes / process crashés (aujourd'hui `last_heartbeat_at` n'est mis à jour que sur ouverture manuelle de `/health`).
4. **Idempotence du provisioning** : clé d'idempotence sur `createBox`, verrou par serveur, nettoyage des Box orphelines en cas d'échec (sinon QStash peut créer des Box dupliquées).

## ÉPOPÉE 9 — Polish catalogue & enforcement résiduel [NICE-TO-HAVE]

1. `seed-mcps.ts` : remplace `@modelcontextprotocol/server-github` (npm **déprécié**) par le binaire officiel recommandé ; fige les versions ; n'inclus que des MCP réellement supportés par le pont retenu ; ajoute limites de ressources/timeouts par MCP.
2. Enforce les capacités déclarées mais non gatées dans `plan-features.ts` : `members` (invitations teamspace), `publishMcp`, `regionSelection`, `auditRetentionDays`, `usageExport` — toujours via les helpers de la source unique.
3. Uniformise la langue de l'UI en **français** (l'app mélange FR auth/billing et EN dashboard/onboarding).
4. Poll le statut sur la page détail serveur (aujourd'hui il faut rafraîchir) ; affiche le compteur serveurs/quota sur le dashboard home.

---

# Contraintes techniques

- **Brownfield strict** : modifie l'existant, ne le réécris pas. Avant toute modif, lis le fichier concerné et son contexte.
- **Upstash Box** pour l'orchestration (pas de Docker custom par utilisateur). Une Box runtime par serveur ; chaque MCP = `install_cmd` puis `start_cmd` en background avec préfixe d'env construit depuis la config déchiffrée. (Option B « VPS sidecar » autorisée si tu la documentes en ADR.)
- **Supabase Auth** (PAS Firebase, PAS Clerk).
- **Drizzle** pour toute évolution de schéma → nouvelle migration `0005_*` + `meta/_journal.json` cohérent.
- **PAS de Vercel** : déploiement = VPS Docker / Dokploy. Pas de service Postgres/Redis local dans `docker-compose.yml` (dépendances managées : Supabase, Upstash). Compose mono-service `app` (un service worker durable additionnel est autorisé si tu choisis cette voie en Épopée 5.4).
- **RBAC strictement per-user** : chaque route vérifie `servers.userId === auth.userId` (ownership). Ne jamais exposer les serveurs d'un autre user.
- **Secrets** : tout secret MCP passe par `lib/crypto/config-encryption.ts` (AES-256-GCM, `config_ciphertext/iv/tag`). Propriétés `secret:true` masquées en lecture. Réutilise ce mécanisme.
- **Plan gating** : toute modif passe par la **source unique** `lib/plan-features.ts` (+ miroir `pricing-data.ts`). Ne duplique pas les limites.
- **Tests sur vrai Postgres** (avec extensions `vector`/`pg_trgm`), pas de mock DB. Les tests existants couvrent auth/oauth/rbac/billing/validation ; **ajoute** les tests d'intégration manquants sur le chemin runtime réel.
- **Préfixe de clé API** = `ctx7sk_` (réel). Si tu changes pour `tmcp_`, propage **partout** (auth, UI, docs) ; sinon corrige l'UI vers `ctx7sk_`.
- **Conformité protocole MCP** : Streamable HTTP, `protocolVersion` ≥ `2024-11-05`, `Authorization: Bearer`.

---

# Parcours utilisateur cible « clé en main »

1. **Inscription** (Supabase) → choix du plan (Free avance, Pro/Team → Stripe Checkout).
2. Redirection auto vers `/onboarding` (5 étapes Plan→IDE→Server→MCP→Connect).
3. **Provisionner un serveur MCP** : 1 clic → `POST /api/v2/servers` (quota + box-size gating) → Box réelle créée → `status=running` **uniquement après un `initialize` MCP réussi** (pas un simple ping).
4. **Installer un MCP** depuis le catalogue (config dynamique via `config_schema`, secrets chiffrés).
5. **Connecter à un LLM en 1 clic** : l'utilisateur reçoit **UNE URL MCP par MCP** (`{origin}/api/mcp/{serverSlug}/{mcpSlug}`) + **UNE clé API `ctx7sk_`**, et un **bloc `mcp.json` copiable** pré-rempli pour son IDE (Cursor/Claude Code/Claude Desktop/Windsurf/Cline). Il colle, son client négocie le transport MCP, voit **les outils du MCP connecté** via `tools/list`, et appelle un outil avec succès. *(Si l'agrégateur multi-MCP de l'Épopée 2.3 est livré, alors une URL serveur expose tous les outils — sinon, s'en tenir à « les outils du MCP connecté ».)*
6. **Bouton « Test connection »** = vrai handshake MCP (`initialize` + `tools/list`) → voyant vert garanti.
7. La config reste **ré-affichable et copiable depuis le dashboard** à tout moment.

---

# Definition of Done / checklist de lancement

- [ ] Un utilisateur crée un serveur, installe ≥ 1 MCP (≠ docs), et un **client MCP standard** s'y connecte et appelle un outil **avec succès, en prod, sans mode stub**.
- [ ] `isStubMode()` impossible en production ; aucun endpoint `*.stub.box.local` ni domaine `*.mcp.twinmcp.dev` produit.
- [ ] Un serveur ne passe `running` qu'après un `initialize` MCP réussi ; les échecs d'install propagent `status='error'` (plus de catch silencieux).
- [ ] Proxy MCP conforme Streamable HTTP (`GET`/`POST`/`DELETE` + `Mcp-Session-Id`).
- [ ] Jobs `uninstall-mcp`/`disable-mcp`/`reconfigure-mcp` câblés et propagés à la Box, sans casser le rattrapage d'install différée au `start`.
- [ ] URL de connexion = **une seule source de vérité** (`/api/mcp/<slug>/<mcp>`, une URL par MCP), copiable depuis onboarding ET dashboard ; préfixe `ctx7sk_` cohérent ; aucune réf à un package/domaine inexistant ; aucune promesse « tous les outils » non tenue.
- [ ] `.env.example` définit les 2 vars de boot Supabase + toutes les vars lues par le code ; noms Stripe réconciliés **dans `check-env.ts`** (4 IDs monthly/yearly) ; `CONFIG_ENCRYPTION_KEY`/`UPSTASH_BOX_API_KEY`/QStash documentés ; `pnpm check-env` vert.
- [ ] Séquence DB documentée/automatisée (extensions → migrate → seed).
- [ ] Stratégie de file de prod tranchée (QStash durable OU worker dédié).
- [ ] Checkout Pro **et** Team fonctionnel (`price_...` valides) ; réconciliation au downgrade ; secrets rotés et hors repo ; `CORS_ORIGIN` fixé ; `TWINMCP_ALLOW_DEV_AUTH` impossible en prod.
- [ ] Une seule autorité d'auth ; pas de store OAuth en mémoire.
- [ ] `README.md` + `PRODUCTION.md` + `PROVISIONING.md` réécrits (VPS/Dokploy/Supabase/MCP) ; domaine de prod uniforme.
- [ ] Tests d'intégration end-to-end du chemin runtime réel verts.

---

# Vérification

Exécute et fais passer (depuis la racine, pnpm). **Renseigne d'abord un `.env.local` complet** (build args `NEXT_PUBLIC_*` + env runtime) sinon les étapes Docker/health échouent.

```bash
# Dépendances
pnpm install

# Contrat d'env (autorité) — doit être VERT avec les noms Stripe réconciliés
pnpm --filter @twinmcp/backend check-env

# Typecheck + lint
pnpm --filter @twinmcp/backend typecheck
pnpm --filter @twinmcp/backend lint
pnpm --filter @twinmcp/backend exec drizzle-kit check   # drift de schéma

# DB (vrai Postgres avec extensions)
psql "$DATABASE_URL_UNPOOLED" -f apps/backend/src/db/migrations/0000_init_extensions.sql
pnpm --filter @twinmcp/backend db:migrate
pnpm --filter @twinmcp/backend seed:mcps

# Tests (incluant les nouveaux tests d'intégration runtime)
pnpm --filter @twinmcp/backend test

# Build Docker (cible réelle VPS) — fournir les NEXT_PUBLIC_* comme BUILD ARGS
docker compose build app \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL"

# Démarrer avec l'env RUNTIME (DB, chiffrement, Box, etc.) sinon /api/health renvoie degraded/503
docker compose --env-file .env.production up -d app   # .env.production = secrets, JAMAIS committé
curl -fsS http://localhost:3000/api/health   # doit renvoyer healthy (DB OK)

# Smoke test MCP end-to-end (le critère de succès cœur) :
# 1) créer une clé API ctx7sk_ ; 2) créer un serveur ; 3) installer un MCP (≠ docs) ;
# 4) handshake via le proxy authentifié :
curl -s -X POST "$APP_URL/api/mcp/<serverSlug>/<mcpSlug>" \
  -H "Authorization: Bearer ctx7sk_..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'
# puis tools/list puis tools/call → doivent renvoyer un résultat RÉEL (pas stub).
```

**Ne fais pas** : ne committe aucun secret ; ne touche pas à `lib/servers/catalog.ts` (SEO) ; ne réintroduis pas Vercel/Firebase/Clerk ; ne duplique pas les limites de plan hors `plan-features.ts` ; n'aligne pas `.env.example` sur les vieux noms Stripe (`STRIPE_PRICE_PRO/TEAM`) — corrige `check-env.ts` ; ne pars pas chasser des vars Firebase dans `.env.example` (il n'y en a pas) ; n'affiche jamais « Server is live » sur la base d'un `ping` en mode stub ; ne promets jamais « tous les outils » sans agrégateur ; ne marque pas une tâche faite tant que son critère d'acceptation n'est pas vérifié par une commande ci-dessus.
