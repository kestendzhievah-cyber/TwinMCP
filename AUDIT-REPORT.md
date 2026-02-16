# TwinMCP — Audit Complet : Fonctionnalité & Scalabilité

**Date :** 13 février 2026  
**État actuel :** 153 erreurs TypeScript, 42/52 suites de tests en échec (132/465 tests KO)

---

## RÉSUMÉ EXÉCUTIF

| Catégorie | Sévérité | Problèmes | Impact |
|-----------|----------|-----------|--------|
| A. Configuration Jest | 🔴 CRITIQUE | Jest exécute des fichiers non-test + downloads/ | Faux échecs massifs |
| B. Module `redis` manquant | 🔴 CRITIQUE | 4 fichiers src/ + 1 packages/ cassés | Gateway, OAuth, Redis inutilisables |
| C. Erreurs TypeScript source | 🟠 MAJEUR | 21 erreurs dans 7 fichiers src/ | Build TS échoue |
| D. Tests cassés (vrais bugs) | 🟠 MAJEUR | ~25 suites avec bugs réels | Couverture non fiable |
| E. .gitignore corrompu | 🟡 MOYEN | Entrées dupliquées 11× | Pollution du repo |
| F. Dépendance manquante | 🟡 MOYEN | `prometheus-client`, `@testing-library/jest-dom` | Scripts/tests cassés |
| G. netlify.toml incohérent | 🟡 MOYEN | `publish: "out"` mais output=standalone | Déploiement Netlify cassé |
| H. Pas de route `/api/health` | 🟡 MOYEN | K8s livenessProbe pointe vers route inexistante | Health checks échouent |
| I. API Gateway Fastify désactivé | 🟡 MOYEN | CORS, rate-limit, helmet commentés | Gateway non sécurisé |
| J. InvoiceService JSON.parse | 🟡 MOYEN | Crash sur données undefined | Facturation cassée |

---

## A. CONFIGURATION JEST — 🔴 CRITIQUE

### Problème 1 : Jest exécute des fichiers non-test comme tests
Les fichiers suivants ne sont PAS des tests mais sont exécutés par Jest :
- `__tests__/setup.ts` — fichier setupFilesAfterEnv, pas un test
- `__tests__/setup.billing.ts` — fichier setup, pas un test
- `__tests__/global-setup.ts` — globalSetup, pas un test
- `__tests__/global-teardown.ts` — globalTeardown, pas un test
- `__tests__/mocks/uuid.ts` — mock, pas un test
- `__tests__/mocks/billing.mocks.ts` — mock, pas un test
- `__tests__/fixtures/billing.fixtures.ts` — fixture, pas un test

**Cause :** `testMatch: ['**/__tests__/**/*.ts']` attrape TOUT fichier .ts dans __tests__/

### Problème 2 : Jest exécute les fichiers dans downloads/
Le dossier `downloads/github/facebook/react/compiler/...` contient des fichiers .ts qui matchent le pattern Jest.

**Cause :** `roots: ['<rootDir>']` + `testMatch` global = Jest scanne tout le projet

### Fix requis :
```js
// jest.config.js
testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
testPathIgnorePatterns: [
  '<rootDir>/__tests__/.*\\.d\\.ts$',
  '<rootDir>/downloads/',
  '<rootDir>/node_modules/',
],
```

---

## B. MODULE `redis` MANQUANT — 🔴 CRITIQUE

Le package `redis` (node-redis v4) n'est PAS dans package.json. Le projet utilise `ioredis` (via `lib/redis.ts`), mais 5 fichiers importent `redis` :

| Fichier | Import |
|---------|--------|
| `src/config/redis.config.ts` | `import { createClient } from 'redis'` |
| `src/gateway/api-gateway.ts` | `import { createClient } from 'redis'` |
| `src/gateway/oauth-routes.ts` | `import { createClient } from 'redis'` |
| `src/services/oauth.service.ts` | `import { createClient } from 'redis'` |
| `packages/mcp-server/src/services/library-resolution.service.ts` | `import { createClient, RedisClientType } from 'redis'` |

**Options :**
1. Migrer ces 5 fichiers vers `ioredis` (cohérent avec le reste du projet)
2. Ajouter `redis` comme dépendance (crée une double dépendance Redis)

**Recommandation :** Option 1 — migrer vers `ioredis` pour cohérence.

---

## C. ERREURS TYPESCRIPT SOURCE (21 erreurs, 7 fichiers)

### C1. `src/controllers/api-key.controller.ts` — 6 erreurs
**Bug :** `string | string[]` passé là où `string` est attendu.
**Fix :** Cast explicite `as string` sur les paramètres de requête.

### C2. `src/routes/embeddings.routes.ts` — 3 erreurs
**Bug :** Même problème `string | string[]` → `string`.

### C3. `src/config/redis.config.ts` — 1 erreur
**Bug :** Module `redis` introuvable (voir section B).

### C4. `src/gateway/api-gateway.ts` — 1 erreur
**Bug :** Module `redis` introuvable.

### C5. `src/gateway/oauth-routes.ts` — 1 erreur
**Bug :** Module `redis` introuvable.

### C6. `src/services/oauth.service.ts` — 1 erreur
**Bug :** Module `redis` introuvable.

### C7. `src/test/database.test.ts` — 6 erreurs
**Bug :** Accès à `.email`, `.id`, `.length` sur type `{}`. Types mal inférés.

### C8. `scripts/performance-monitor.ts` — 1 erreur
**Bug :** Module `prometheus-client` introuvable.

### C9. `packages/mcp-server/src/services/library-resolution.service.ts` — 1 erreur
**Bug :** Module `redis` introuvable (mais `redis` est dans packages/mcp-server/package.json — probablement `npm install` manquant dans ce sous-package).

---

## D. TESTS CASSÉS — ANALYSE PAR CATÉGORIE

### D1. Tests avec bugs dans le service source (vrais bugs)

| Test | Erreur | Cause racine |
|------|--------|-------------|
| `invoice.service.test.ts` | `JSON.parse(undefined)` | `getInvoice()` ne vérifie pas si row.period est null/undefined avant JSON.parse |
| `stripe.service.test.ts` | `refundPayment is not a function` | API du service ne correspond pas aux tests |
| `paypal.service.test.ts` | `authenticate is not a function` | API du service ne correspond pas aux tests |
| `monitoring.service.test.ts` | `Cannot read 'find' of undefined` | Mock incomplet ou API changée |
| `conversation.service.test.ts` | `"[object Object]" is not valid JSON` | Objet passé à JSON.parse au lieu d'une string |
| `search-matching.service.test.ts` | `Cannot read 'rows' of undefined` | Mock pool.query ne retourne pas `{ rows: [...] }` |
| `analytics.service.test.ts` | `Cannot read 'rows' of undefined` | Même problème de mock |
| `search-analytics.service.test.ts` | `cleanupOldLogs is not a function` | Méthode renommée ou supprimée |
| `embedding-generation.service.test.ts` | `generateCacheKey is not a function` | Méthode privée ou renommée |
| `streaming-billing.service.test.ts` | `Cannot read 'connectedAt' of undefined` | Mock incomplet |

### D2. Tests avec imports cassés

| Test | Erreur |
|------|--------|
| `api-key.service.test.ts` | Import `../../../src/services/api-key.service` — chemin incorrect (devrait être `../../src/...`) |
| `oauth.service.test.ts` | Module `redis` introuvable |
| `mcp-protocol.integration.test.ts` | Import `../../../lib/mcp/utils/server-factory` — chemin incorrect (devrait être `../../lib/...`) |
| `setup.billing.ts` | Module `@testing-library/jest-dom` introuvable |

### D3. Tests avec mocks insuffisants

| Test | Problème |
|------|----------|
| `query-docs.tool.test.ts` | `Cannot read 'cleanup' of undefined` |
| `rate-limiting/*.test.ts` | `this.redis.del is not a function` — mock Redis incomplet |
| `context-intelligent.service.test.ts` | Mock data structure mismatch |
| `prompt-system.test.ts` | `"[object Object]" is not valid JSON` |

---

## E. .gitignore CORROMPU

Le fichier `.gitignore` contient des entrées corrompues avec `-e ` (résidu de commandes `echo -e`) et 11 duplications du bloc `*.env` / `*.env.*`.

**Fix :** Nettoyer le fichier pour ne garder qu'une seule occurrence.

---

## F. DÉPENDANCES MANQUANTES

| Package | Utilisé par | Type |
|---------|------------|------|
| `prometheus-client` | `scripts/performance-monitor.ts` | devDependency |
| `@testing-library/jest-dom` | `__tests__/setup.billing.ts` | devDependency |
| `redis` (node-redis v4) | 4 fichiers src/ | Voir section B |

---

## G. NETLIFY.TOML INCOHÉRENT

```toml
[build]
  command = "npm run build"
  publish = "out"    # ← FAUX : next.config.js a output: 'standalone', pas 'export'
```

Avec `output: 'standalone'`, Next.js ne génère pas de dossier `out/`. Le déploiement Netlify échouera.

**Fix :** Soit changer `publish = ".next"` + utiliser le plugin `@netlify/plugin-nextjs`, soit retirer `output: 'standalone'` pour Netlify.

---

## H. ROUTE `/api/health` MANQUANTE

- `middleware.ts` whitelist `/api/health` comme route publique
- `docker-compose.yml` healthcheck pointe vers `/api/health`
- `k8s/deployment.yaml` livenessProbe pointe vers `/api/health`
- **MAIS** la route n'existe pas ! Le health check est à `/api/monitoring/health` et `/api/v1/mcp/health`

**Fix :** Créer `app/api/health/route.ts` avec un simple health check.

---

## I. API GATEWAY FASTIFY — PLUGINS DÉSACTIVÉS

Dans `src/gateway/api-gateway.ts`, les plugins suivants sont commentés :
- **CORS** (`@fastify/cors`)
- **Rate limiting** (`@fastify/rate-limit`)
- **Helmet** (sécurité headers)
- **Compression** (`@fastify/compress`)

Le gateway Fastify est donc un serveur HTTP nu sans protection.

**Note :** Le middleware Next.js (`middleware.ts`) gère l'auth pour les routes Next.js, mais le gateway Fastify est un serveur séparé.

---

## J. INVOICE SERVICE — JSON.parse SUR UNDEFINED

`src/services/invoice.service.ts:148` fait `JSON.parse(row.period)` sans vérifier si `row.period` existe. Même problème pour `row.items`, `row.billing_address`, `row.metadata`.

**Fix :** Ajouter des gardes : `row.period ? JSON.parse(row.period) : null`

---

## K. PROBLÈMES DE SCALABILITÉ

### K1. Double client Redis
- `lib/redis.ts` utilise `ioredis` (singleton)
- `src/config/redis.config.ts` utilise `redis` (node-redis v4)
- Certains services utilisent l'un, d'autres l'autre → incohérence

### K2. Double client DB
- `lib/prisma.ts` exporte `prisma` (PrismaClient) ET `pool` (pg.Pool)
- Certains services utilisent Prisma, d'autres pg.Pool directement
- L'InvoiceService utilise pg.Pool avec des requêtes SQL brutes

### K3. K8s readinessProbe pointe vers `/api/ready` — route inexistante

### K4. Pas de connection pooling Redis documenté

### K5. `next.config.js` ignore les erreurs TS et ESLint au build
```js
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```
Cela masque les 153 erreurs TS en production.

---

## PLAN DE CORRECTION — PAR PRIORITÉ

### 🔴 Phase 1 : Corrections critiques (bloquantes)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 1.1 | Fix jest.config.js — testMatch + testPathIgnorePatterns | `jest.config.js` | 5 min |
| 1.2 | Migrer 4 fichiers src/ de `redis` → `ioredis` | 4 fichiers src/ | 30 min |
| 1.3 | Créer route `/api/health` | `app/api/health/route.ts` | 10 min |
| 1.4 | Créer route `/api/ready` | `app/api/ready/route.ts` | 10 min |
| 1.5 | Fix InvoiceService JSON.parse guards | `src/services/invoice.service.ts` | 15 min |

### 🟠 Phase 2 : Erreurs TypeScript source (0 erreurs src/)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 2.1 | Fix `string \| string[]` → `string` casts | `api-key.controller.ts`, `embeddings.routes.ts` | 15 min |
| 2.2 | Fix `src/test/database.test.ts` types | `database.test.ts` | 10 min |
| 2.3 | Remplacer `prometheus-client` par stub ou prom-client | `scripts/performance-monitor.ts` | 15 min |

### 🟡 Phase 3 : Tests — imports et mocks cassés

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 3.1 | Fix import paths (../../ → correct depth) | `api-key.service.test.ts`, `mcp-protocol.integration.test.ts` | 10 min |
| 3.2 | Ajouter `@testing-library/jest-dom` ou retirer l'import | `setup.billing.ts` | 5 min |
| 3.3 | Fix mocks Redis (ajouter `.del`, `.get`, `.set`) | Tests rate-limiting | 20 min |
| 3.4 | Fix mocks pool.query (retourner `{ rows: [...] }`) | ~8 test files | 45 min |
| 3.5 | Aligner API services ↔ tests (stripe, paypal) | ~4 test files | 30 min |

### 🟢 Phase 4 : Nettoyage et cohérence

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 4.1 | Nettoyer .gitignore (supprimer duplications) | `.gitignore` | 5 min |
| 4.2 | Fix netlify.toml (publish path) | `netlify.toml` | 5 min |
| 4.3 | Réactiver plugins Fastify gateway ou documenter | `api-gateway.ts` | 30 min |
| 4.4 | Consolider Redis → ioredis partout | Audit global | 20 min |

### 🔵 Phase 5 : Scalabilité avancée

| # | Tâche | Effort |
|---|-------|--------|
| 5.1 | Retirer `ignoreBuildErrors: true` une fois 0 erreurs TS | 5 min |
| 5.2 | Migrer services pg.Pool → Prisma (InvoiceService, etc.) | 2-4h |
| 5.3 | Ajouter Redis connection pooling / sentinel config | 30 min |
| 5.4 | Ajouter monitoring Prometheus réel (prom-client) | 1h |
| 5.5 | CI/CD pipeline (GitHub Actions) avec tests + build | 1h |

---

## ESTIMATION TOTALE

| Phase | Effort estimé |
|-------|--------------|
| Phase 1 (Critique) | ~1h |
| Phase 2 (TS errors) | ~40 min |
| Phase 3 (Tests) | ~2h |
| Phase 4 (Nettoyage) | ~1h |
| Phase 5 (Scalabilité) | ~5h |
| **TOTAL** | **~10h** |

---

*Voulez-vous que je commence les corrections ? Je recommande de démarrer par la Phase 1 (corrections critiques).*
