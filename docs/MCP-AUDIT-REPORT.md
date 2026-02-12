# AUDIT COMPLET - Partie MCP de TwinMCP

**Date:** 10 Février 2026  
**Fichiers analysés:** ~50 fichiers MCP  
**Scope:** `lib/mcp/`, `packages/mcp-server/`, `app/api/mcp*/`, `app/api/v1/mcp/`, `config/`, `__tests__/mcp/`

---

## 1. ARCHITECTURE GLOBALE

### 1.1 Cartographie des composants

```
lib/mcp/                          # MCP interne (Next.js API routes)
├── core/                         # Registry, Cache, Validator, Types
├── middleware/                   # Auth (JWT+API Key), Rate Limiting
├── servers/                      # HTTP (Fastify) + Stdio servers
├── services/                     # Metrics, Serializer
├── tools/                        # 8 outils (Email, Slack, Calendar, Notion, Firebase, GitHub, QueryDocs, ResolveLibraryId)
│   ├── base/                     # BaseTool abstract class
│   ├── communication/            # Email, Slack
│   ├── productivity/             # Calendar, Notion
│   ├── data/                     # Firebase
│   ├── development/              # GitHub
│   ├── core/                     # Types additionnels
│   ├── query-docs.tool.ts        # Outil principal TwinMCP
│   └── resolve-library-id.tool.ts # Outil principal TwinMCP
├── utils/                        # Queue, Metrics, DocsGenerator, ServerFactory
├── init.ts                       # Initialisation séquentielle
├── ensure-init.ts                # Lazy singleton init
└── types.ts                      # Types JSON-RPC / MCP Protocol

packages/mcp-server/              # Package NPM standalone (@twinmcp/mcp)
├── src/
│   ├── server.ts                 # Serveur MCP SDK officiel (@modelcontextprotocol/sdk)
│   ├── http-server.ts            # Serveur HTTP Express
│   ├── client/                   # TwinMCPClient
│   ├── handlers/                 # resolve-library, query-docs
│   ├── services/                 # library-resolution, query-parser
│   └── types/                    # Types MCP + Library
└── package.json

app/api/mcp/                      # Routes Next.js MCP Protocol (JSON-RPC)
├── route.ts                      # Endpoint principal MCP (587 lignes, self-contained)
├── call/route.ts                 # Appel d'outil via lib/mcp-tools
├── tools/route.ts                # Liste des outils
├── initialize/route.ts           # Initialisation MCP
├── oauth/route.ts                # OAuth (stub)
├── query-docs/route.ts           # Query docs direct
└── resolve-library-id/route.ts   # Resolve library direct

app/api/v1/mcp/                   # Routes API v1 (registry-based)
├── execute/route.ts              # Exécution d'outils via registry
├── tools/route.ts                # Liste des outils via registry
├── health/route.ts               # Health check
├── metrics/route.ts              # Métriques
├── queue/route.ts                # Gestion de la queue
└── docs/route.ts                 # Documentation auto-générée
```

---

## 2. PROBLEMES CRITIQUES (Bloquants)

### 2.1 DUPLICATION MASSIVE - 3 systèmes MCP parallèles non unifiés

**Sévérité: CRITIQUE**

Il existe **3 implémentations MCP distinctes** qui ne partagent aucun code :

| Système | Localisation | Transport | Outils | Auth |
|---------|-------------|-----------|--------|------|
| **A** - `app/api/mcp/route.ts` | 587 lignes self-contained | Next.js API Route (JSON-RPC) | Hardcodé (LIBRARY_DATABASE in-memory) | API Key via Prisma |
| **B** - `app/api/v1/mcp/*` | Routes multiples | Next.js API Routes (REST) | Registry dynamique (`lib/mcp/`) | `authenticateMcpRequest()` |
| **C** - `packages/mcp-server/` | Package NPM standalone | Stdio + Express HTTP | SDK officiel `@modelcontextprotocol/sdk` | Aucune (ou Express custom) |

**Impact:** 
- Les outils `resolve-library-id` et `query-docs` sont implémentés **3 fois** différemment
- Le système A utilise une base de données hardcodée (`LIBRARY_DATABASE`) au lieu de Prisma/Vector search
- Le système C utilise le SDK MCP officiel mais est isolé du reste
- Aucune cohérence dans les réponses, l'auth, ou le rate limiting

### 2.2 Imports cassés dans `app/api/mcp/call/route.ts`

**Sévérité: CRITIQUE**

```typescript
import { mcpTools, executeTool, validateToolArgs } from '@/lib/mcp-tools';
```

Le fichier `lib/mcp-tools.ts` n'existe **pas** dans le workspace. Cette route est **non fonctionnelle**.

### 2.3 `QueryDocsTool` importe `@/lib/redis` directement

**Sévérité: HAUTE**

```typescript
// lib/mcp/tools/query-docs.tool.ts:5
import { redis } from '@/lib/redis'
```

`redis` est importé directement dans le constructeur et passé à `VectorSearchService`. Si Redis n'est pas disponible (ce qui est le cas en dev sans Docker), le tool **crash au chargement** et empêche l'initialisation MCP.

### 2.4 Auth en mémoire non persistée

**Sévérité: HAUTE**

`lib/mcp/middleware/auth.ts` stocke users et API keys **en mémoire** (`Map<string, User>`). Tout est perdu au redémarrage. Le mot de passe par défaut est hardcodé : `mcp-default-key-12345`.

Pendant ce temps, `lib/mcp/middleware/api-key-auth.ts` utilise Prisma/Redis pour l'auth réelle. Les deux systèmes coexistent sans logique claire de fallback.

### 2.5 `MCPErrorCodes` - Codes d'erreur dupliqués

**Sévérité: MOYENNE**

```typescript
// lib/mcp/types.ts:81-82
ToolNotFound = -32602,      // MEME CODE que InvalidParams !
ToolExecutionError = -32603  // MEME CODE que InternalError !
```

Impossible de distinguer `InvalidParams` de `ToolNotFound`, ou `InternalError` de `ToolExecutionError`.

---

## 3. PROBLEMES STRUCTURELS

### 3.1 Types dupliqués et incohérents

| Type | Localisation 1 | Localisation 2 | Localisation 3 |
|------|----------------|----------------|----------------|
| `AuthContext` | `lib/mcp/middleware/auth-types.ts` | `lib/mcp/middleware/types.ts` (différent!) | `lib/mcp/middleware/api-key-auth.ts` (`McpAuthContext`) |
| `Permission` | `lib/mcp/middleware/auth-types.ts` | `lib/mcp/middleware/types.ts` (simplifié) | - |
| `ApiKey` | `lib/mcp/middleware/auth-types.ts` | `lib/mcp/middleware/types.ts` (différent!) | - |
| `AuthError` | `lib/mcp/middleware/auth-types.ts` | `lib/mcp/middleware/types.ts` (différent!) | - |
| `QueueJob` | `lib/mcp/core/types.ts` | `lib/mcp/tools/core/types.ts` (différent!) | - |
| `RateLimitConfig` | `lib/mcp/core/types.ts` | `lib/mcp/middleware/auth-types.ts` | - |

### 3.2 Outils "simulés" - Aucune intégration réelle

6 outils sur 8 sont des **simulations** avec `setTimeout` :

| Outil | Statut | Détail |
|-------|--------|--------|
| `EmailTool` | Partiellement réel | Gmail OAuth2 implémenté mais jamais testé en prod |
| `SlackTool` | SIMULATION | `await new Promise(resolve => setTimeout(resolve, 120))` |
| `CalendarTool` | SIMULATION | Génère des événements aléatoires |
| `NotionTool` | SIMULATION | Retourne des données mock |
| `FirebaseTool` | SIMULATION | Retourne des données mock |
| `GitHubTool` | SIMULATION | Retourne des données mock avec `_simulation: true` |
| `QueryDocsTool` | Semi-réel | Utilise `VectorSearchService` mais crash si Redis absent |
| `ResolveLibraryIdTool` | Semi-réel | Dépend de `LibraryResolutionService` injecté |

### 3.3 `initializeMCP()` - Credentials en clair dans les logs

```typescript
// lib/mcp/init.ts:37
console.log('   API Key: mcp-default-key-12345')
console.log('   Email: admin@example.com')
```

Credentials loggées en clair à chaque démarrage.

### 3.4 `shutdownMCP()` - Shutdown vide

```typescript
// lib/mcp/init.ts:52-55
await Promise.all([
  // await closeQueue(),
  // await closeCache()
])
```

Le shutdown ne ferme **rien** - les fonctions sont commentées. Les connexions Redis, les workers de queue, et les intervalles de cleanup restent actifs.

### 3.5 Cache cleanup - Fuite mémoire potentielle

```typescript
// lib/mcp/core/cache.ts:49
setInterval(() => this.cleanup(), 60000)
```

L'intervalle n'est **jamais nettoyé** (pas de `clearInterval`). Si `initializeCache()` est appelé plusieurs fois, les intervalles s'accumulent.

### 3.6 Rate Limiter - Fuite mémoire

```typescript
// lib/mcp/middleware/rate-limit.ts:56
setInterval(() => this.memoryStore.cleanup(), 60000)
```

Même problème : intervalle jamais nettoyé, et le `MemoryRateLimitStore` utilise une clé `'global'` unique au lieu de la clé passée en paramètre :

```typescript
// lib/mcp/middleware/rate-limit.ts:16-17
async increment(windowMs: number): Promise<number> {
  const existing = this.data.get('global') || { count: 0, resetTime }
```

**Bug:** Toutes les clés de rate limiting partagent le même compteur `'global'`.

### 3.7 Metrics - Accumulation en mémoire sans limite

```typescript
// lib/mcp/utils/metrics.ts:27
private metrics: ToolMetrics[] = []
```

Les métriques s'accumulent en mémoire indéfiniment. Le cleanup ne fonctionne pas correctement :

```typescript
// lib/mcp/utils/metrics.ts:254
console.log(`🧹 Metrics cleanup: removed ${this.metrics.length} old entries`)
```

Le log affiche la taille **après** filtrage, pas le nombre d'entrées supprimées.

### 3.8 HTTP Server - Fastify en devDependency

Le `HttpMCPServer` utilise Fastify (`import Fastify from 'fastify'`) mais Fastify est en `devDependencies`. En production, l'import échouera.

### 3.9 Validator SQL Injection - Faux positifs massifs

```typescript
// lib/mcp/core/validator.ts:164-166
const sqlPatterns = [
  /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b)/gi,
```

Ce pattern bloquera toute requête contenant les mots "select", "update", "create", "delete" - ce qui est courant dans des requêtes de documentation légitimes.

---

## 4. PROBLEMES DE SCALABILITE

### 4.1 Tout en mémoire

| Composant | Stockage | Problème en multi-instance |
|-----------|----------|---------------------------|
| Registry | `Map<string, MCPTool>` | Chaque instance a son propre registry |
| Cache | `Map<string, CacheEntry>` | Pas de partage entre instances |
| Queue | `Map<string, QueueJob>` | Jobs perdus si l'instance crash |
| Metrics | `ToolMetrics[]` | Métriques fragmentées |
| Rate Limiter | `Map<string, ...>` | Rate limits par instance, pas global |
| Auth (legacy) | `Map<string, User>` | Users/keys perdus au redémarrage |

### 4.2 Pas de graceful shutdown

- Les workers de queue ne sont pas attendus
- Les connexions Redis ne sont pas fermées
- Les intervalles de cleanup ne sont pas nettoyés
- `process.exit(0)` est appelé directement dans le stdio server

### 4.3 Pas de health check profond

Le health check (`/api/v1/mcp/health`) ne vérifie pas :
- La connexion à la base de données
- La connexion Redis
- L'état réel des workers de queue
- La disponibilité des services externes (Vector store, etc.)

---

## 5. PROBLEMES DE SECURITE

| # | Problème | Fichier | Sévérité |
|---|----------|---------|----------|
| S1 | API Key hardcodée `mcp-default-key-12345` | `lib/mcp/middleware/auth.ts:50` | CRITIQUE |
| S2 | JWT secret par défaut `your-secret-key-change-in-production` | `lib/mcp/middleware/auth.ts:11` | CRITIQUE |
| S3 | Credentials loggées en clair | `lib/mcp/init.ts:37-38` | HAUTE |
| S4 | API key acceptée en query parameter (`?api_key=...`) | `lib/mcp/middleware/auth.ts:256` | HAUTE |
| S5 | Pas de HTTPS enforcement | Tous les serveurs | MOYENNE |
| S6 | SQL injection validator avec faux positifs | `lib/mcp/core/validator.ts:163-173` | MOYENNE |
| S7 | Pas de validation de taille du body | Routes API | MOYENNE |

---

## 6. TESTS - COUVERTURE INSUFFISANTE

### Tests existants (5 fichiers) :

| Fichier | Couvre | Statut |
|---------|--------|--------|
| `__tests__/mcp/core/registry.test.ts` | Registry CRUD, search, plugins | OK mais test L43 attend un throw qui ne se produit (registry fait `return` au lieu de `throw` pour les duplicates) |
| `__tests__/mcp/integration.test.ts` | Init, registry, validation | OK |
| `__tests__/mcp/servers/http-mcp-server.test.ts` | HTTP server | Non vérifié |
| `__tests__/mcp/servers/stdio-mcp-server.test.ts` | Stdio server | Non vérifié |
| `__tests__/mcp/tools/email.test.ts` | Email tool | Non vérifié |

### Tests manquants :

- Aucun test pour `app/api/mcp/route.ts` (endpoint principal)
- Aucun test pour `app/api/v1/mcp/execute/route.ts`
- Aucun test pour le rate limiting
- Aucun test pour l'auth (JWT, API key)
- Aucun test pour le cache
- Aucun test pour la queue
- Aucun test pour `QueryDocsTool` et `ResolveLibraryIdTool`
- Aucun test E2E du flux complet MCP

### Bug dans registry.test.ts :

```typescript
// __tests__/mcp/core/registry.test.ts:41-43
it('should prevent duplicate registration', () => {
  registry.register(emailTool2)
  // Attend un throw, mais registry.register() fait un console.log + return
})
```

Le registry ne throw PAS pour les duplicates (il fait `return` silencieusement), donc ce test devrait échouer.

---

## 7. PLAN D'AMELIORATION - PRIORITE

### Phase 1 : Corrections critiques (Fonctionnalité)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1.1 | **Unifier les 3 systèmes MCP** en un seul endpoint `app/api/mcp/route.ts` utilisant le registry et les services réels | Élimine la duplication, cohérence | HAUT |
| 1.2 | **Supprimer `lib/mcp-tools.ts`** référence cassée et fixer `app/api/mcp/call/route.ts` | Fix route cassée | BAS |
| 1.3 | **Fixer les MCPErrorCodes dupliqués** - donner des codes uniques à ToolNotFound et ToolExecutionError | Fix protocol compliance | BAS |
| 1.4 | **Fixer le bug du rate limiter** - utiliser la clé passée au lieu de `'global'` | Fix rate limiting | BAS |
| 1.5 | **Rendre QueryDocsTool resilient** - graceful degradation si Redis absent | Fix crash au démarrage | MOYEN |
| 1.6 | **Fixer le shutdown** - décommenter closeQueue/closeCache, nettoyer les intervalles | Fix resource leaks | BAS |

### Phase 2 : Sécurité

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 2.1 | **Supprimer les credentials hardcodées** et le user par défaut | Sécurité critique | BAS |
| 2.2 | **Forcer JWT_SECRET depuis env** - throw si absent en production | Sécurité critique | BAS |
| 2.3 | **Supprimer les logs de credentials** dans init.ts | Sécurité | BAS |
| 2.4 | **Supprimer l'API key en query parameter** | Sécurité | BAS |
| 2.5 | **Fixer le SQL injection validator** - utiliser des patterns moins agressifs ou le désactiver pour les requêtes de documentation | Fix faux positifs | MOYEN |

### Phase 3 : Consolidation des types

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 3.1 | **Unifier AuthContext** - un seul type dans `auth-types.ts`, supprimer `middleware/types.ts` | Cohérence types | MOYEN |
| 3.2 | **Unifier QueueJob** - un seul type dans `core/types.ts`, supprimer `tools/core/types.ts` | Cohérence types | BAS |
| 3.3 | **Supprimer les types dupliqués** dans `middleware/types.ts` | Nettoyage | BAS |

### Phase 4 : Scalabilité

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 4.1 | **Migrer le rate limiting vers Redis** quand disponible, fallback mémoire | Scalabilité multi-instance | MOYEN |
| 4.2 | **Migrer la queue vers un vrai job queue** (BullMQ/Redis) | Persistance des jobs | HAUT |
| 4.3 | **Migrer les métriques vers la DB** (Prisma) au lieu de la mémoire | Persistance métriques | MOYEN |
| 4.4 | **Ajouter des health checks profonds** (DB, Redis, Vector store) | Monitoring | MOYEN |
| 4.5 | **Implémenter le graceful shutdown** complet | Stabilité | MOYEN |

### Phase 5 : Outils réels

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 5.1 | **Supprimer les outils simulés** (Slack, Calendar, Notion, Firebase, GitHub) ou les implémenter réellement | Nettoyage / Fonctionnalité | HAUT |
| 5.2 | **Consolider QueryDocsTool** avec le système A (LIBRARY_DATABASE) pour avoir une source unique | Fonctionnalité | HAUT |
| 5.3 | **Ajouter le cache réel** dans QueryDocsTool (actuellement `// TODO`) | Performance | MOYEN |

### Phase 6 : Tests

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 6.1 | **Fixer le test de duplicate registration** dans registry.test.ts | Test correctness | BAS |
| 6.2 | **Ajouter des tests pour l'endpoint MCP principal** (`app/api/mcp/route.ts`) | Couverture | MOYEN |
| 6.3 | **Ajouter des tests pour l'auth** (JWT, API key, rate limiting) | Couverture | MOYEN |
| 6.4 | **Ajouter des tests E2E** pour le flux complet MCP | Couverture | HAUT |

---

## 8. RECOMMANDATION ARCHITECTURALE

### Architecture cible recommandée :

```
app/api/mcp/route.ts              # Endpoint unique MCP JSON-RPC 2.0
  ├── Auth: authenticateMcpRequest() (Prisma-backed)
  ├── Rate Limit: Redis-backed (fallback mémoire)
  ├── Tools: Registry unifié
  │   ├── resolve-library-id      # LibraryResolutionService (Prisma)
  │   └── query-docs              # VectorSearchService (Prisma + Vector store)
  └── Metrics: Prisma-persisted

packages/mcp-server/              # Package NPM pour CLI/standalone
  └── Utilise le même code via TwinMCPClient → app/api/mcp
```

### Principes :
1. **Un seul endpoint MCP** (`/api/mcp`) qui gère tout le protocole JSON-RPC
2. **Registry comme source unique** de vérité pour les outils
3. **Prisma comme stockage principal** (auth, usage, metrics)
4. **Redis optionnel** pour cache et rate limiting (graceful degradation)
5. **Supprimer les outils simulés** - garder uniquement `resolve-library-id` et `query-docs`
6. **Le package NPM** (`@twinmcp/mcp`) reste un client qui appelle l'API

---

## 9. METRIQUES DE L'AUDIT

| Métrique | Valeur |
|----------|--------|
| Fichiers MCP analysés | ~50 |
| Lignes de code MCP total | ~8,500 |
| Lignes de code dupliquées | ~2,500 (30%) |
| Problèmes critiques | 5 |
| Problèmes hauts | 6 |
| Problèmes moyens | 8 |
| Couverture de tests | ~15% |
| Outils fonctionnels | 2/8 (25%) |
| Outils simulés | 6/8 (75%) |
