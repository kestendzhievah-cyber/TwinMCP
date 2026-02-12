# TwinMCP - Architecture Documentation

## Table des matières

1. [Introduction](./introduction.md)
2. [Architecture de haut niveau](./high-level-architecture.md)
3. [Stack technique](./tech-stack.md)
4. [Composants](./components.md)
5. [Modèles de données](./data-models.md)
6. [Workflows principaux](./core-workflows.md)
7. [APIs externes](./external-apis.md)
8. [Sécurité](./security.md)
9. [Gestion des erreurs](./error-handling-strategy.md)
10. [Infrastructure et déploiement](./infrastructure-and-deploy.md)
11. [Standards de code](./coding-standards.md)
12. [Stratégie de tests](./test-strategy-and-standards.md)
13. [Arborescence du projet](./source-tree.md)
14. [Checklist & Rapport](./checklist-results-report.md)
15. [Prochaines étapes](./next-steps.md)

---

## introduction.md

# Introduction

## Contexte du projet

TwinMCP est un serveur MCP (Model Context Protocol) conçu pour fournir aux IDE et LLM des extraits de documentation et de code toujours à jour pour n'importe quelle bibliothèque logicielle.

## Objectifs

- **Reproduire les fonctionnalités de Context7** : offrir une alternative open-source et extensible
- **Support multi-bibliothèques** : Node.js, Python, TypeScript, et autres écosystèques
- **Intégration IDE** : Cursor, Claude Code, Opencode et autres clients MCP
- **Architecture SaaS** : multi-tenant avec authentification et quotas
- **Documentation à jour** : crawling automatique et versioning des bibliothèques

## Périmètre

### Inclus
- Serveur MCP avec protocole stdio et HTTP
- API backend pour gestion des comptes et rate-limiting
- Moteur de parsing et crawling de documentation
- Dashboard utilisateur
- Support OAuth 2.0 et API key

### Exclus (Phase 1)
- Interface de contribution collaborative
- Support des bibliothèques propriétaires privées
- Intégration CI/CD avancée

## Parties prenantes

- **Utilisateurs finaux** : Développeurs utilisant des IDE compatibles MCP
- **Administrateurs** : Équipe DevOps gérant l'infrastructure
- **Contributeurs** : Développeurs ajoutant le support de nouvelles bibliothèques

---

## high-level-architecture.md

# Architecture de haut niveau

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients MCP                          │
│  (Cursor, Claude Code, Opencode, VS Code extensions)       │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
             │ stdio/local              │ HTTP/remote
             │                          │
┌────────────▼──────────┐    ┌──────────▼─────────────────────┐
│   TwinMCP Server      │    │   API Gateway (HTTPS)          │
│   (NPM Package)       │    │   /mcp, /mcp/oauth             │
│   - resolve-library   │    └──────────┬─────────────────────┘
│   - query-docs        │               │
└───────────────────────┘               │
                                        │
                        ┌───────────────▼──────────────────────┐
                        │     Backend Services Layer            │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   Authentication Service        │ │
                        │  │   - API Key validation          │ │
                        │  │   - OAuth 2.0 flow              │ │
                        │  └─────────────────────────────────┘ │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   MCP Request Handler           │ │
                        │  │   - Tool routing                │ │
                        │  │   - Rate limiting               │ │
                        │  └─────────────────────────────────┘ │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   Library Resolution Engine     │ │
                        │  │   - Query parsing               │ │
                        │  │   - Library matching            │ │
                        │  └─────────────────────────────────┘ │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   Documentation Query Engine    │ │
                        │  │   - Vector search               │ │
                        │  │   - Context assembly            │ │
                        │  └─────────────────────────────────┘ │
                        │                                       │
                        └───────────────┬───────────────────────┘
                                        │
                        ┌───────────────▼──────────────────────┐
                        │        Data Layer                     │
                        │                                       │
                        │  ┌──────────────┐  ┌──────────────┐  │
                        │  │  PostgreSQL  │  │ Vector Store │  │
                        │  │  (metadata)  │  │ (embeddings) │  │
                        │  └──────────────┘  └──────────────┘  │
                        │                                       │
                        │  ┌──────────────┐  ┌──────────────┐  │
                        │  │    Redis     │  │  S3/Storage  │  │
                        │  │   (cache)    │  │   (docs)     │  │
                        │  └──────────────┘  └──────────────┘  │
                        └───────────────────────────────────────┘

                        ┌───────────────────────────────────────┐
                        │    Background Jobs Layer              │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   Crawling Service              │ │
                        │  │   - GitHub release monitoring   │ │
                        │  │   - Docs updates detection      │ │
                        │  └─────────────────────────────────┘ │
                        │                                       │
                        │  ┌─────────────────────────────────┐ │
                        │  │   Parsing Service               │ │
                        │  │   - Markdown processing         │ │
                        │  │   - Code snippet extraction     │ │
                        │  │   - Embedding generation        │ │
                        │  └─────────────────────────────────┘ │
                        └───────────────────────────────────────┘
```

## Principes architecturaux

### 1. Séparation des préoccupations
- **Serveur MCP** : interface protocol-compliant, léger
- **Backend** : logique métier, orchestration
- **Data Layer** : persistence et caching

### 2. Scalabilité
- Architecture stateless pour le serveur MCP
- Cache distribué (Redis) pour réduire la latence
- Queue de jobs pour le crawling asynchrone

### 3. Extensibilité
- Plugin system pour ajouter de nouvelles bibliothèques
- API modulaire pour intégrer de nouveaux IDE/clients

### 4. Résilience
- Rate limiting par tenant
- Circuit breakers sur les services externes
- Fallback sur cache en cas de défaillance

---

## tech-stack.md

# Stack technique

## Backend

### Langage principal
- **TypeScript** (Node.js 20+)
  - Typage fort, aligné sur Context7
  - Ecosystem mature pour MCP

### Framework API
- **Fastify** ou **Express**
  - Performance élevée
  - Middleware ecosystem riche

### MCP SDK
- **@modelcontextprotocol/sdk**
  - Implémentation officielle du protocole MCP
  - Support stdio et HTTP

## Base de données

### Principale
- **PostgreSQL 15+**
  - Stockage des métadonnées (bibliothèques, utilisateurs, clés API)
  - Support JSON pour metadata flexible

### Vector Store
- **Pinecone** ou **Qdrant**
  - Recherche sémantique dans la documentation
  - Embeddings avec OpenAI ou alternatives open-source

### Cache
- **Redis 7+**
  - Cache des résolutions de bibliothèques
  - Session OAuth
  - Rate limiting

### Object Storage
- **AWS S3** / **MinIO**
  - Stockage des docs crawlées brutes
  - Versioning des snapshots

## Traitement asynchrone

- **BullMQ** (Redis-based queue)
  - Jobs de crawling
  - Jobs de parsing et embedding

## Authentification

- **Passport.js** (OAuth 2.0)
- **jsonwebtoken** (JWT pour API keys)

## Crawling & Parsing

- **Octokit** (GitHub API)
- **Cheerio** (HTML parsing)
- **unified/remark** (Markdown processing)

## Frontend (Dashboard)

- **React** / **Next.js 14+**
- **Tailwind CSS**
- **shadcn/ui** components

## Infrastructure

### Containerisation
- **Docker** / **Docker Compose**

### Orchestration
- **Kubernetes** (production) ou **Railway** / **Render** (MVP)

### CI/CD
- **GitHub Actions**

### Monitoring
- **Prometheus** + **Grafana**
- **Sentry** (error tracking)

### Logs
- **Winston** / **Pino**

---

## components.md

# Composants

## 1. TwinMCP Server (NPM Package)

**Responsabilités** :
- Exposer les outils MCP (`resolve-library-id`, `query-docs`)
- Gérer les connexions stdio (local) et HTTP (remote)
- Valider les requêtes entrantes
- Relayer les appels au backend

**Technologies** :
- TypeScript, `@modelcontextprotocol/sdk`
- Package NPM `@twinmcp/mcp`

**Interfaces** :
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (params: unknown) => Promise<MCPToolResult>;
}
```

---

## 2. API Gateway

**Responsabilités** :
- Point d'entrée HTTPS pour connexions remote
- Routage vers endpoints MCP (`/mcp`, `/mcp/oauth`)
- Authentification (API key, OAuth bearer token)
- Rate limiting par tenant

**Endpoints** :
- `POST /mcp` : MCP calls avec API key
- `POST /mcp/oauth` : MCP calls avec OAuth
- `GET /health` : Healthcheck

---

## 3. Authentication Service

**Responsabilités** :
- Validation des API keys
- Gestion du flux OAuth 2.0 (authorization code flow)
- Génération de tokens JWT
- Révocation de clés

**Modèles** :
- `User` (id, email, créationDate)
- `ApiKey` (key, userId, quotas, créationDate, lastUsed)
- `OAuthToken` (accessToken, refreshToken, expiresAt, userId)

---

## 4. Library Resolution Engine

**Responsabilités** :
- Parsing de la query utilisateur
- Matching fuzzy avec le catalogue de bibliothèques
- Retour de l'identifiant canonique `/vendor/library`

**Algorithme** :
1. Extraction des entités (nom de lib, version potentielle)
2. Recherche dans l'index (PostgreSQL full-text search ou Elasticsearch)
3. Scoring par popularité et pertinence
4. Retour du meilleur match

**Exemple** :
```
Input: "How do I set up Supabase auth?"
Output: { libraryId: "/supabase/supabase", confidence: 0.95 }
```

---

## 5. Documentation Query Engine

**Responsabilités** :
- Recherche vectorielle dans les embeddings de docs
- Assemblage du contexte optimisé pour LLM
- Classement des snippets par pertinence

**Flux** :
1. Génération d'embedding pour la query
2. Recherche K-NN dans le vector store
3. Récupération des chunks de documentation
4. Assemblage avec métadonnées (URL source, version)

**Optimisations** :
- Cache Redis pour queries fréquentes
- Reranking avec modèle cross-encoder

---

## 6. Crawling Service

**Responsabilités** :
- Monitoring des releases GitHub via API
- Détection de nouvelles versions
- Téléchargement des sources (README, docs, examples)

**Stratégies** :
- **Pull mode** : polling périodique (1x/jour)
- **Push mode** : webhooks GitHub (si disponible)

**Jobs** :
- `crawl:library` (par bibliothèque)
- `crawl:all` (batch hebdomadaire)

---

## 7. Parsing Service

**Responsabilités** :
- Extraction de contenu structuré (Markdown → JSON)
- Découpage en chunks optimisés (512-1024 tokens)
- Génération d'embeddings
- Stockage dans vector store et S3

**Pipeline** :
```
Raw docs (S3)
  → Markdown parsing (unified/remark)
  → Chunking (semantic splitter)
  → Embedding (OpenAI text-embedding-3-small)
  → Vector store + PostgreSQL metadata
```

---

## 8. Dashboard Web

**Responsabilités** :
- Gestion des clés API
- Visualisation des quotas et usage
- Catalogue des bibliothèques supportées
- Configuration des règles MCP

**Pages** :
- `/dashboard` : Vue d'ensemble
- `/dashboard/api-keys` : Gestion des clés
- `/dashboard/libraries` : Catalogue
- `/dashboard/usage` : Statistiques

---

## data-models.md

# Modèles de données

## Schema PostgreSQL

### Table `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255),
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(10) NOT NULL, -- pour affichage partiel
  name VARCHAR(100),
  quota_requests_per_minute INT DEFAULT 60,
  quota_requests_per_day INT DEFAULT 10000,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

### Table `libraries`
```sql
CREATE TABLE libraries (
  id VARCHAR(100) PRIMARY KEY, -- ex: /mongodb/docs
  name VARCHAR(255) NOT NULL,
  vendor VARCHAR(100),
  repo_url VARCHAR(500),
  docs_url VARCHAR(500),
  default_version VARCHAR(50),
  popularity_score INT DEFAULT 0,
  total_snippets INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  last_crawled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- tags, categories, etc.
);

CREATE INDEX idx_libraries_name ON libraries USING gin(to_tsvector('english', name));
```

### Table `library_versions`
```sql
CREATE TABLE library_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id VARCHAR(100) REFERENCES libraries(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  release_date DATE,
  is_latest BOOLEAN DEFAULT FALSE,
  docs_snapshot_url VARCHAR(500), -- S3 path
  UNIQUE(library_id, version)
);
```

### Table `documentation_chunks`
```sql
CREATE TABLE documentation_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_version_id UUID REFERENCES library_versions(id) ON DELETE CASCADE,
  chunk_index INT,
  content TEXT NOT NULL,
  content_type VARCHAR(50), -- 'snippet', 'guide', 'api_ref'
  source_url VARCHAR(500),
  token_count INT,
  embedding_id VARCHAR(255), -- ID dans le vector store
  metadata JSONB, -- { section, subsection, code_language, etc. }
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chunks_library_version ON documentation_chunks(library_version_id);
```

### Table `usage_logs`
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  tool_name VARCHAR(50), -- 'resolve-library-id', 'query-docs'
  library_id VARCHAR(100),
  query TEXT,
  tokens_returned INT,
  response_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_api_key_created ON usage_logs(api_key_id, created_at DESC);
```

---

## Vector Store Schema (Pinecone/Qdrant)

### Structure d'un vecteur
```json
{
  "id": "chunk_uuid",
  "values": [0.123, -0.456, ...], // embedding (1536 dimensions)
  "metadata": {
    "library_id": "/mongodb/docs",
    "version": "7.0",
    "content_type": "snippet",
    "source_url": "https://...",
    "chunk_text": "Sample code..."
  }
}
```

---

## Redis Cache

### Clés
- `library:resolve:{query_hash}` → `{ libraryId, confidence }`
- `docs:query:{library_id}:{query_hash}` → `{ snippets, ttl: 3600 }`
- `rate_limit:{api_key}:{window}` → compteur
- `oauth:session:{state}` → OAuth flow data

---

## core-workflows.md

# Workflows principaux

## Workflow 1 : Résolution de bibliothèque

**Acteurs** : IDE/LLM, TwinMCP Server, Library Resolution Engine

**Étapes** :

1. **Client envoie une requête MCP**
   ```json
   {
     "tool": "resolve-library-id",
     "params": {
       "query": "How do I set up MongoDB authentication?",
       "libraryName": "MongoDB"
     }
   }
   ```

2. **TwinMCP Server valide l'API key** (si remote) ou passe directement (si stdio)

3. **Appel au Library Resolution Engine**
   - Hash de la query pour vérifier le cache Redis
   - Si cache hit → retour immédiat
   - Sinon → recherche dans PostgreSQL (full-text search sur `libraries.name`)

4. **Scoring et sélection**
   - Calcul de similarité (Levenshtein + popularité)
   - Retour du meilleur match

5. **Réponse au client**
   ```json
   {
     "libraryId": "/mongodb/docs",
     "name": "MongoDB Official Documentation",
     "repoUrl": "https://github.com/mongodb/docs",
     "defaultVersion": "7.0",
     "confidence": 0.95
   }
   ```

---

## Workflow 2 : Interrogation de documentation

**Acteurs** : IDE/LLM, TwinMCP Server, Documentation Query Engine

**Étapes** :

1. **Client envoie une requête MCP**
   ```json
   {
     "tool": "query-docs",
     "params": {
       "libraryId": "/mongodb/docs",
       "query": "Show me an example of connection pooling"
     }
   }
   ```

2. **Vérification des quotas** (rate limiting via Redis)

3. **Génération de l'embedding de la query**
   - Appel à OpenAI API ou modèle local

4. **Recherche vectorielle**
   - K-NN dans Pinecone/Qdrant (top 10 chunks)
   - Filtrage par `library_id` et `version`

5. **Reranking** (optionnel)
   - Cross-encoder pour affiner l'ordre

6. **Assemblage du contexte**
   - Concaténation des chunks avec métadonnées
   - Limitation à ~4000 tokens pour le LLM

7. **Réponse au client**
   ```json
   {
     "content": "Here's how to configure MongoDB connection pooling:\n\n```javascript\n...\n```\n\nSee: https://mongodb.com/docs/...",
     "snippets": [
       {
         "text": "...",
         "sourceUrl": "...",
         "relevanceScore": 0.89
       }
     ]
   }
   ```

---

## Workflow 3 : Crawling d'une nouvelle bibliothèque

**Acteurs** : Admin, Crawling Service, Parsing Service

**Étapes** :

1. **Ajout d'une bibliothèque au catalogue** (dashboard ou API)
   ```sql
   INSERT INTO libraries (id, name, repo_url, docs_url)
   VALUES ('/vercel/next.js', 'Next.js', 'https://github.com/vercel/next.js', 'https://nextjs.org/docs');
   ```

2. **Déclenchement du job de crawling** (BullMQ)
   ```typescript
   await crawlQueue.add('crawl:library', { libraryId: '/vercel/next.js' });
   ```

3. **Téléchargement des sources**
   - Clonage Git shallow ou fetch via GitHub API
   - Téléchargement de la doc officielle (scraping si nécessaire)

4. **Stockage brut dans S3**
   - Path: `s3://twinmcp-docs/vercel/next.js/14.0/raw/`

5. **Déclenchement du job de parsing**
   ```typescript
   await parseQueue.add('parse:library', { libraryId: '/vercel/next.js', version: '14.0' });
   ```

6. **Parsing et chunking**
   - Extraction du Markdown structuré
   - Découpage en chunks sémantiques

7. **Génération d'embeddings**
   - Batch processing via OpenAI API

8. **Insertion dans vector store et PostgreSQL**
   ```sql
   INSERT INTO documentation_chunks (library_version_id, content, embedding_id, ...)
   VALUES (...);
   ```

9. **Mise à jour des métadonnées**
   ```sql
   UPDATE libraries SET last_crawled_at = NOW(), total_snippets = 1234 WHERE id = '/vercel/next.js';
   ```

---

## Workflow 4 : Authentification OAuth 2.0

**Acteurs** : Utilisateur, IDE (Cursor/Claude Code), API Gateway, Auth Service

**Étapes** :

1. **Utilisateur configure MCP remote avec OAuth** dans l'IDE

2. **IDE déclenche le flow OAuth**
   - Ouverture du navigateur vers `https://api.twinmcp.com/auth/oauth/authorize?client_id=...&redirect_uri=...`

3. **Utilisateur se connecte** (ou s'inscrit) sur le dashboard TwinMCP

4. **Autorisation accordée**
   - Redirection vers `redirect_uri` avec `code`

5. **IDE échange le code contre un token**
   ```http
   POST /auth/oauth/token
   {
     "grant_type": "authorization_code",
     "code": "abc123",
     "client_id": "...",
     "client_secret": "..."
   }
   ```

6. **Auth Service retourne un access token**
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "...",
     "expires_in": 3600
   }
   ```

7. **IDE stocke le token** et l'utilise dans les headers pour les appels MCP
   ```http
   POST /mcp/oauth
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## external-apis.md

# APIs externes

## 1. GitHub API (Octokit)

**Usage** : Monitoring des releases, récupération du code source

**Endpoints utilisés** :
- `GET /repos/{owner}/{repo}/releases` : Liste des releases
- `GET /repos/{owner}/{repo}/git/trees/{sha}` : Arborescence du repo
- `GET /repos/{owner}/{repo}/contents/{path}` : Contenu d'un fichier

**Rate limits** :
- 5000 requêtes/heure (authentifié)
- Gestion du `X-RateLimit-Remaining` header

**Gestion d'erreurs** :
- Retry avec backoff exponentiel
- Fallback sur cache si quota épuisé

---

## 2. OpenAI API

**Usage** : Génération d'embeddings

**Modèle** : `text-embedding-3-small` (1536 dimensions)

**Coût** : $0.02 / 1M tokens

**Optimisations** :
- Batch requests (jusqu'à 2048 inputs)
- Cache des embeddings pour queries fréquentes

**Alternatives** :
- Sentence-Transformers (open-source, hébergé)
- Cohere Embed API

---

## 3. Pinecone / Qdrant API

**Usage** : Stockage et recherche vectorielle

**Opérations** :
- `POST /vectors/upsert` : Insertion de vecteurs
- `POST /query` : Recherche K-NN
- `DELETE /vectors` : Suppression

**Configuration** :
- Index dimension: 1536
- Metric: cosine similarity
- Pods: 1x p1 (MVP), scale selon usage

---

## security.md

# Sécurité

## 1. Authentification

### API Keys
- **Format** : `twinmcp_live_<32_chars_random>` (production) ou `twinmcp_test_<32_chars_random>` (test)
- **Stockage** : Hashed avec bcrypt (cost factor 12)
- **Rotation** : Encouragée tous les 90 jours
- **Révocation** : Soft delete (`revoked_at` timestamp)

### OAuth 2.0
- **Flow** : Authorization Code with PKCE
- **Scopes** : `mcp:read`, `mcp:write`, `dashboard:read`
- **Token expiration** : Access token 1h, refresh token 30 jours
- **Storage** : Redis pour les sessions, PostgreSQL pour les refresh tokens

---

## 2. Transport

- **HTTPS obligatoire** pour tous les endpoints publics
- **TLS 1.3** minimum
- **Certificate pinning** recommandé pour les clients

---

## 3. Rate Limiting

### Par API key
- **Global** : 100 req/min, 10000 req/jour (tier free)
- **Premium** : 1000 req/min, 1M req/mois

### Par IP
- **Fallback** si pas d'API key : 10 req/min

### Implémentation
- Redis avec sliding window
- Header `X-RateLimit-Remaining` dans les réponses

---

## 4. Validation des entrées

### Requêtes MCP
```typescript
const resolveLibrarySchema = z.object({
  query: z.string().min(1).max(500),
  libraryName: z.string().min(1).max(100)
});
```

### Sanitization
- Échappement SQL (via ORM Prisma/TypeORM)
- Validation des URLs (whitelist de domaines pour crawling)

---

## 5. Protection contre les abus

### DDoS
- Cloudflare ou équivalent en front
- Rate limiting aggressif sur `/mcp` endpoints

### Content Safety
- Scan des docs crawlées avec règles anti-malware
- Détection de contenu NSFW/haineux (hors scope initial, mais prévu)

---

## 6. RGPD & Données personnelles

- **Données collectées** : Email, usage logs (requêtes anonymisées)
- **Durée de rétention** : Logs 90 jours, comptes jusqu'à suppression
- **Droit à l'oubli** : Endpoint `/account/delete` (soft delete puis purge après 30j)

---

## 7. Audit & Monitoring

- **Logs d'authentification** : Toutes les tentatives (succès/échec)
- **Logs d'accès MCP** : Tool appelé, library, user_id, timestamp
- **Alertes** : Seuils anormaux de rate limit, erreurs 5xx

---

## error-handling-strategy.md

# Stratégie de gestion des erreurs

## 1. Classification des erreurs

### Erreurs client (4xx)
- `400 Bad Request` : Validation échouée
- `401 Unauthorized` : API key invalide/expirée
- `403 Forbidden` : Quota dépassé
- `404 Not Found` : Library introuvable
- `429 Too Many Requests` : Rate limit

### Erreurs serveur (5xx)
- `500 Internal Server Error` : Erreur non gérée
- `502 Bad Gateway` : Service externe indisponible
- `503 Service Unavailable` : Maintenance

---

## 2. Format de réponse d'erreur

```typescript
interface ErrorResponse {
  error: {
    code: string; // ex: 'LIBRARY_NOT_FOUND'
    message: string; // Human-readable
    details?: unknown; // Debug info (en dev seulement)
    requestId: string; // Pour le support
  };
}
```

**Exemple** :
```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have exceeded your daily quota of 10000 requests. Upgrade your plan or try again tomorrow.",
    "requestId": "req_abc123xyz"
  }
}
```

---

## 3. Gestion dans le serveur MCP

### Wrapping des handlers
```typescript
async function safeMCPHandler(
  handler: (params: unknown) => Promise<MCPToolResult>
): Promise<MCPToolResult> {
  try {
    return await handler(params);
  } catch (error) {
    logger.error('MCP handler error', { error, stack: error.stack });
    
    if (error instanceof ValidationError) {
      throw new MCPError('INVALID_INPUT', error.message);
    }
    
    if (error instanceof AuthenticationError) {
      throw new MCPError('UNAUTHORIZED', 'Invalid API key');
    }
    
    throw new MCPError('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}
```

---

## 4. Retry & Circuit Breaker

### Appels externes (GitHub, OpenAI)
```typescript
import { retry } from '@lifeomic/attempt';

const result = await retry(
  async () => await githubClient.getRelease(repo),
  {
    maxAttempts: 3,
    delay: 1000,
    factor: 2, // backoff exponentiel
    handleError(err, context) {
      if (err.status === 404) {
        context.abort(); // Ne pas retry si 404
      }
    }
  }
);
```

### Circuit Breaker (avec opossum)
```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(fetchEmbedding, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.fallback(() => getCachedEmbedding());
```

---

## 5. Logging structuré

```typescript
logger.error('Library resolution failed', {
  query: params.query,
  libraryName: params.libraryName,
  userId: context.userId,
  error: error.message,
  stack: error.stack,
  requestId: context.requestId
});
```

**Niveaux** :
- `debug` : Détails techniques (dev uniquement)
- `info` : Événements normaux (requêtes MCP)
- `warn` : Situations anormales non bloquantes (cache miss)
- `error` : Erreurs nécessitant investigation

---

## 6. Monitoring & Alertes

### Métriques à surveiller
- Taux d'erreur par endpoint (> 5% → alerte)
- Latence P95 (> 2s → alerte)
- Quota dépassé fréquent (indicateur de croissance)

### Alertes Sentry
- Grouper les erreurs par `error.code`
- Ignorer les erreurs 4xx sauf `401` (potentielle attaque)

---

## infrastructure-and-deploy.md

# Infrastructure et déploiement

## 1. Architecture d'hébergement

### Option 1 : Kubernetes (Production)

```yaml
# Namespace dédié
apiVersion: v1
kind: Namespace
metadata:
  name: twinmcp

---

# Deployment MCP API
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-api
  namespace: twinmcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-api
  template:
    metadata:
      labels:
        app: mcp-api
    spec:
      containers:
      - name: api
        image: twinmcp/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---

# Service
apiVersion: v1
kind: Service
metadata:
  name: mcp-api-service
  namespace: twinmcp
spec:
  selector:
    app: mcp-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---

# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-api-hpa
  namespace: twinmcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

### Option 2 : Railway / Render (MVP rapide)

**Railway** :
- Déploiement via GitHub (auto-deploy sur push)
- Provisioning automatique de PostgreSQL, Redis
- Scaling vertical simple

**Render** :
- Configuration via `render.yaml`
- Support Docker natif
- Managed PostgreSQL inclus

---

## 2. CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy TwinMCP

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Run tests
        run: npm test
        
      - name: Run type check
        run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t twinmcp/api:${{ github.sha }} .
        
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push twinmcp/api:${{ github.sha }}
          docker tag twinmcp/api:${{ github.sha }} twinmcp/api:latest
          docker push twinmcp/api:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/mcp-api api=twinmcp/api:${{ github.sha }} -n twinmcp
          kubectl rollout status deployment/mcp-api -n twinmcp
```

---

## 3. Configuration environnement

### Variables d'environnement (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/twinmcp
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Vector Store
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=twinmcp-docs

# S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=twinmcp-docs
AWS_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=xxx

# GitHub
GITHUB_TOKEN=xxx

# Auth
JWT_SECRET=xxx
OAUTH_CLIENT_ID=xxx
OAUTH_CLIENT_SECRET=xxx

# API
API_BASE_URL=https://api.twinmcp.com
PORT=3000
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_FREE_RPM=100
RATE_LIMIT_FREE_RPD=10000
RATE_LIMIT_PREMIUM_RPM=1000

# Monitoring
SENTRY_DSN=xxx
```

---

## 4. Backups & Disaster Recovery

### PostgreSQL
- **Snapshots automatiques** : 1x/jour (retention 30 jours)
- **WAL archiving** : Continuous backup
- **Restore time objective (RTO)** : < 1h
- **Recovery point objective (RPO)** : < 15 min

### Redis
- **RDB snapshots** : Toutes les 6h
- **AOF** : Append-only file pour durabilité

### S3
- **Versioning activé** : Récupération des docs supprimées
- **Cross-region replication** : us-east-1 → eu-west-1

---

## 5. Scaling Strategy

### Horizontal Scaling
- **API Gateway** : Load balancer (NGINX/Cloudflare)
- **Backend workers** : Auto-scaling basé sur CPU/RAM
- **Background jobs** : Queue workers scalables (BullMQ)

### Vertical Scaling
- **Database** : Upgrade de la taille d'instance selon charge
- **Redis** : Cluster mode si > 10GB données

### Caching Strategy
- **CDN** (Cloudflare) : Assets statiques (dashboard)
- **Redis** : Réponses API fréquentes (TTL 1h)
- **Application cache** : In-memory pour config

---

## coding-standards.md

# Standards de code

## 1. Conventions TypeScript

### Naming
```typescript
// Classes: PascalCase
class LibraryResolver {}

// Interfaces: PascalCase avec préfixe I (optionnel)
interface IMCPTool {}

// Types: PascalCase
type MCPRequest = {};

// Variables/functions: camelCase
const apiKey = 'xxx';
function resolveLibrary() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private members: préfixe _
class Service {
  private _cache: Map<string, unknown>;
}
```

---

### File Structure
```
src/
├── server/           # Serveur MCP
│   ├── tools/        # Implémentation des outils MCP
│   ├── handlers/     # Handlers de requêtes
│   └── index.ts
├── services/         # Logique métier
│   ├── auth/
│   ├── library/
│   └── docs/
├── models/           # Modèles de données (Prisma)
├── utils/            # Utilitaires
├── types/            # Types TypeScript partagés
└── config/           # Configuration
```

---

### Imports
```typescript
// Ordre des imports:
// 1. Node built-ins
import { promises as fs } from 'fs';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (ordre alphabétique)
import { AuthService } from '@/services/auth';
import { LibraryResolver } from '@/services/library';
import { logger } from '@/utils/logger';

// 4. Types
import type { MCPRequest } from '@/types';
```

---

## 2. Linting & Formatting

### ESLint (.eslintrc.js)
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn'
  }
};
```

### Prettier (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## 3. Documentation

### JSDoc pour fonctions publiques
```typescript
/**
 * Résout l'identifiant d'une bibliothèque à partir d'une query utilisateur
 * 
 * @param query - Question ou tâche de l'utilisateur
 * @param libraryName - Nom humain de la bibliothèque
 * @returns Identifiant canonique et métadonnées
 * @throws {LibraryNotFoundError} Si aucune bibliothèque ne correspond
 * 
 * @example
 * ```typescript
 * const result = await resolveLibrary('How to use MongoDB?', 'MongoDB');
 * console.log(result.libraryId); // '/mongodb/docs'
 * ```
 */
export async function resolveLibrary(
  query: string,
  libraryName: string
): Promise<LibraryResolution> {
  // ...
}
```

---

## 4. Error Handling

### Custom Errors
```typescript
export class TwinMCPError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TwinMCPError';
  }
}

export class LibraryNotFoundError extends TwinMCPError {
  constructor(libraryName: string) {
    super('LIBRARY_NOT_FOUND', `Library '${libraryName}' not found`, 404);
  }
}
```

---

## 5. Git Workflow

### Commit Messages (Conventional Commits)
```
feat: add OAuth 2.0 support for Cursor
fix: resolve library resolution timeout
docs: update installation guide
refactor: extract embedding logic to service
test: add integration tests for query-docs tool
chore: upgrade dependencies
```

### Branch Naming
- `feat/oauth-support`
- `fix/rate-limit-bug`
- `docs/api-reference`

---

## test-strategy-and-standards.md

# Stratégie de tests

## 1. Pyramide de tests

```
        /\
       /  \        E2E (5%)
      /____\
     /      \      Integration (25%)
    /________\
   /          \    Unit (70%)
  /__________  \
```

---

## 2. Tests unitaires

### Framework: Jest + ts-jest

```typescript
// services/library/resolver.test.ts
import { LibraryResolver } from './resolver';
import { mockLibraryRepository } from '@/test/mocks';

describe('LibraryResolver', () => {
  let resolver: LibraryResolver;

  beforeEach(() => {
    resolver = new LibraryResolver(mockLibraryRepository);
  });

  it('should resolve MongoDB library from query', async () => {
    const result = await resolver.resolve('How to use MongoDB?', 'MongoDB');
    
    expect(result.libraryId).toBe('/mongodb/docs');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should throw LibraryNotFoundError for unknown library', async () => {
    await expect(
      resolver.resolve('test', 'UnknownLib123')
    ).rejects.toThrow(LibraryNotFoundError);
  });
});
```

---

## 3. Tests d'intégration

### Avec base de données de test

```typescript
// __tests__/integration/mcp-api.test.ts
import { setupTestDB, teardownTestDB } from '@/test/db';
import { createTestServer } from '@/test/server';
import { createTestUser, createApiKey } from '@/test/fixtures';

describe('MCP API Integration', () => {
  let server;
  let apiKey;

  beforeAll(async () => {
    await setupTestDB();
    server = await createTestServer();
    const user = await createTestUser();
    apiKey = await createApiKey(user.id);
  });

  afterAll(async () => {
    await teardownTestDB();
    await server.close();
  });

  it('should resolve library via MCP tool', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'TWINMCP_API_KEY': apiKey
      },
      payload: {
        tool: 'resolve-library-id',
        params: {
          query: 'Setup Next.js',
          libraryName: 'Next.js'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().libraryId).toBe('/vercel/next.js');
  });
});
```

---

## 4. Tests E2E

### Playwright pour le dashboard

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('should create API key', async ({ page }) => {
  await page.goto('https://dashboard.twinmcp.com');
  
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');
  
  await page.waitForURL('**/dashboard');
  
  await page.click('text=Create API Key');
  await page.fill('[name=keyName]', 'Test Key');
  await page.click('button:has-text("Generate")');
  
  const apiKey = await page.textContent('[data-testid=api-key-value]');
  expect(apiKey).toMatch(/^twinmcp_test_/);
});
```

---

## 5. Coverage Requirements

- **Unit tests** : > 80% coverage
- **Critical paths** : 100% coverage (auth, rate limiting)
- **Rapport** : Généré via `jest --coverage`

---

## 6. Mocks & Fixtures

### Mock OpenAI API
```typescript
// test/mocks/openai.ts
export const mockOpenAI = {
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }]
    })
  }
};
```

### Fixtures
```typescript
// test/fixtures/libraries.ts
export const mongoDBLibrary = {
  id: '/mongodb/docs',
  name: 'MongoDB',
  repo_url: 'https://github.com/mongodb/docs',
  default_version: '7.0'
};
```

---

## source-tree.md

# Arborescence du projet

```
twinmcp/
├── packages/
│   ├── mcp-server/              # Package NPM @twinmcp/mcp
│   │   ├── src/
│   │   │   ├── index.ts         # Point d'entrée
│   │   │   ├── tools/
│   │   │   │   ├── resolve-library.ts
│   │   │   │   └── query-docs.ts
│   │   │   ├── client/
│   │   │   │   ├── stdio.ts     # Client stdio
│   │   │   │   └── http.ts      # Client HTTP
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/                 # API Backend
│       ├── src/
│       │   ├── server.ts        # Point d'entrée Fastify
│       │   ├── routes/
│       │   │   ├── mcp.ts       # /mcp endpoints
│       │   │   ├── auth.ts      # /auth endpoints
│       │   │   └── dashboard.ts
│       │   ├── services/
│       │   │   ├── auth/
│       │   │   │   ├── api-key.service.ts
│       │   │   │   └── oauth.service.ts
│       │   │   ├── library/
│       │   │   │   ├── resolver.service.ts
│       │   │   │   └── repository.ts
│       │   │   ├── docs/
│       │   │   │   ├── query.service.ts
│       │   │   │   └── embedding.service.ts
│       │   │   ├── crawling/
│       │   │   │   ├── github.crawler.ts
│       │   │   │   └── scheduler.ts
│       │   │   └── parsing/
│       │   │       ├── markdown.parser.ts
│       │   │       └── chunker.ts
│       │   ├── models/           # Prisma models
│       │   │   └── schema.prisma
│       │   ├── utils/
│       │   │   ├── logger.ts
│       │   │   ├── cache.ts
│       │   │   └── rate-limiter.ts
│       │   ├── config/
│       │   │   └── index.ts
│       │   └── types/
│       │       └── index.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── __tests__/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── dashboard/               # Next.js Dashboard
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── api-keys/
│       │   │   │   ├── libraries/
│       │   │   │   └── usage/
│       │   │   └── api/
│       │   ├── components/
│       │   │   ├── ui/          # shadcn components
│       │   │   └── dashboard/
│       │   └── lib/
│       │       └── api-client.ts
│       ├── public/
│       ├── package.json
│       └── next.config.js
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.worker
│   │   └── docker-compose.yml
│   ├── k8s/
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   └── terraform/              # (optionnel)
│       ├── main.tf
│       └── variables.tf
│
├── scripts/
│   ├── seed-libraries.ts       # Seed initial des bibliothèques
│   ├── migrate-db.sh
│   └── deploy.sh
│
├── docs/
│   ├── architecture/           # Ce dossier
│   ├── api-reference.md
│   └── user-guide.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json                # Root workspace
├── turbo.json                  # Turborepo config (optionnel)
├── .eslintrc.js
├── .prettierrc
├── .gitignore
└── README.md
```

---

## checklist-results-report.md

# Checklist & Rapport d'Architecture

## ✅ Conformité au CCTP

### Fonctionnalités MCP
- [x] Outil `resolve-library-id` spécifié
- [x] Outil `query-docs` spécifié
- [x] Support stdio (local) défini
- [x] Support HTTP (remote) défini
- [x] Format de réponse compatible LLM

### Authentification
- [x] API Key authentication
- [x] OAuth 2.0 flow
- [x] Gestion des quotas par tier

### Intégrations IDE
- [x] Configuration Cursor (remote + local)
- [x] Configuration Claude Code (remote + local)
- [x] Configuration Opencode (remote + local)

### Gestion des bibliothèques
- [x] Catalogue versionnté
- [x] Résolution fuzzy matching
- [x] Support syntaxe `/vendor/lib`
- [x] Métadonnées (popularité, tokens, snippets)

### Infrastructure
- [x] Architecture scalable définie
- [x] Stratégie de caching (Redis)
- [x] Background jobs (crawling/parsing)
- [x] Monitoring & alertes