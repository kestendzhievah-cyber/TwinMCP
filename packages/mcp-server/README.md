# @twinmcp/mcp

TwinMCP MCP Server - Documentation and code snippets for any library with API key authentication and usage tracking.

## Installation

```bash
npm install @twinmcp/mcp
```

## Usage

### Mode STDIO (pour Claude Desktop, Cursor, etc.)

```bash
npx twinmcp-server
```

### Mode HTTP (pour accès API public avec tracking)

```bash
npx twinmcp-http
```

Ou avec npm scripts:
```bash
npm run start:http
```

## Configuration

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `TWINMCP_PORT` | Port du serveur HTTP | `3001` |
| `TWINMCP_HOST` | Host du serveur | `0.0.0.0` |
| `TWINMCP_API_BASE_URL` | URL de votre SaaS pour auth/tracking | `http://localhost:3000` |
| `TWINMCP_API_KEY` | Clé API interne (optionnel) | - |
| `TWINMCP_INTERNAL_KEY` | Clé pour communication serveur-serveur | - |
| `TWINMCP_CORS_ORIGINS` | Origines CORS autorisées (séparées par virgule) | `*` |

### Exemple de fichier .env

```env
TWINMCP_PORT=3001
TWINMCP_HOST=0.0.0.0
TWINMCP_API_BASE_URL=https://votre-saas.com
TWINMCP_INTERNAL_KEY=votre-cle-interne-secrete
TWINMCP_CORS_ORIGINS=https://votre-app.com,https://autre-app.com
```

## Endpoints API

### Publics (sans authentification)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/api/info` | GET | Informations sur l'API |

### Protégés (clé API requise)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/mcp/tools` | GET | Liste des outils disponibles |
| `/api/mcp/call` | POST | Appeler un outil |
| `/api/mcp/sse` | GET | Connexion SSE pour protocole MCP |
| `/api/usage` | GET | Statistiques d'utilisation |

## Authentification

Fournissez votre clé API via:
- Header `X-API-Key: votre-cle`
- Header `Authorization: Bearer votre-cle`
- Query param `?api_key=votre-cle`

## Exemples d'utilisation

### Lister les outils

```bash
curl -H "X-API-Key: twinmcp_live_xxx" \
  https://votre-serveur.com/api/mcp/tools
```

### Appeler un outil

```bash
curl -X POST \
  -H "X-API-Key: twinmcp_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"tool": "resolve-library-id", "arguments": {"query": "react"}}' \
  https://votre-serveur.com/api/mcp/call
```

### Voir l'utilisation

```bash
curl -H "X-API-Key: twinmcp_live_xxx" \
  https://votre-serveur.com/api/usage
```

## Outils disponibles

### resolve-library-id

Resolve a library name or query to a canonical library identifier.

**Parameters:**
- `query` (required): Natural language query describing the library or functionality needed
- `libraryName` (optional): Specific library name to search for
- `version` (optional): Specific version of the library

### query-docs

Search documentation for a specific library using natural language queries.

**Parameters:**
- `libraryId` (required): The canonical library identifier (e.g., /mongodb/docs)
- `query` (required): Natural language query for searching documentation
- `version` (optional): Specific version of the library
- `contentType` (optional): Filter results by content type ('snippet', 'guide', 'api_ref')
- `maxResults` (optional): Maximum number of results to return (default: 10)
- `maxTokens` (optional): Maximum total tokens in response (default: 4000)

## Intégration avec votre SaaS

Le serveur MCP HTTP appelle votre SaaS pour la validation des clés API et le tracking d'utilisation.

### Endpoints à implémenter sur votre SaaS

#### POST /api/auth/validate-key

Valide une clé API et retourne les informations utilisateur.

**Réponse attendue:**
```json
{
  "valid": true,
  "userId": "user-123",
  "apiKeyId": "key-456",
  "tier": "premium",
  "quotaDaily": 10000,
  "quotaMonthly": 300000,
  "usedDaily": 150,
  "usedMonthly": 4500
}
```

#### POST /api/usage/track

Enregistre l'utilisation d'un outil.

**Corps de la requête:**
```json
{
  "apiKeyId": "key-456",
  "userId": "user-123",
  "toolName": "query-docs",
  "libraryId": "react",
  "query": "how to use hooks",
  "tokensReturned": 1500,
  "responseTimeMs": 234,
  "success": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Usage programmatique

```typescript
import { TwinMCPHttpServer } from '@twinmcp/mcp';

const server = new TwinMCPHttpServer(
  {
    port: 3001,
    host: '0.0.0.0',
    corsOrigins: ['https://votre-app.com'],
    apiKeyValidation: async (apiKey) => {
      // Votre logique de validation
      return { valid: true, userId: '...', apiKeyId: '...' };
    },
    usageTracking: async (data) => {
      // Votre logique de tracking
      console.log('Usage:', data);
    },
  },
  { serverUrl: 'https://api.twinmcp.com' }
);

await server.start();
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Start development server
npm run dev

# Run CLI
npm run cli -- help
```

## License

MIT
