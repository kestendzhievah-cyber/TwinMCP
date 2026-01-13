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
