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
