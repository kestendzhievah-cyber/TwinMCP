# TwinMCP - Serveur MCP de Documentation

TwinMCP est un serveur MCP (Model Context Protocol) conçu pour fournir aux IDE et LLM des extraits de documentation et de code toujours à jour pour n'importe quelle bibliothèque logicielle.

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm ou yarn

### Installation

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd TwinMCP-master
   ```

2. **Installer les dépendances**
   ```bash
   npm run install:legacy
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env.local
   # Éditer .env.local avec vos configurations
   ```

4. **Initialiser TwinMCP**
   ```bash
   npm run twinmcp:init
   ```

Cette commande va :
- ✅ Vérifier les connexions (base de données, Redis)
- ✅ Exécuter les migrations Prisma
- ✅ Seeding des données de test
- ✅ Tester les services
- ✅ Créer une clé API de test

### Démarrer le serveur

```bash
npm run dev
```

Le serveur sera disponible sur `http://localhost:3000`

## 📋 API Endpoints

### Outils MCP Principaux

#### `POST /api/mcp/resolve-library-id`
Résout les noms de bibliothèques et trouve les correspondances.

**Headers:**
```
x-api-key: twinmcp_live_...
# ou
Authorization: Bearer twinmcp_live_...
```

**Body:**
```json
{
  "query": "react",
  "context": {
    "language": "javascript",
    "ecosystem": "npm"
  },
  "limit": 5,
  "include_aliases": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "react",
    "results": [
      {
        "id": "/react/react",
        "name": "react",
        "displayName": "React",
        "description": "A JavaScript library for building user interfaces",
        "language": "javascript",
        "ecosystem": "npm",
        "popularityScore": 0.95,
        "relevanceScore": 0.9,
        "aliases": ["reactjs", "react.js"],
        "tags": ["ui", "frontend", "javascript"],
        "latestVersion": "18.2.0",
        "matchDetails": {
          "matchedField": "name",
          "matchType": "exact",
          "confidence": 0.9
        }
      }
    ],
    "totalFound": 1,
    "processingTimeMs": 45
  }
}
```

#### `POST /api/mcp/query-docs`
Recherche dans la documentation d'une bibliothèque spécifique.

**Body:**
```json
{
  "library_id": "/react/react",
  "query": "how to use hooks",
  "version": "18.2.0",
  "max_results": 5,
  "include_code": true,
  "context_limit": 4000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "library": {
      "id": "/react/react",
      "name": "react",
      "version": "18.2.0",
      "description": "A JavaScript library for building user interfaces"
    },
    "query": "how to use hooks",
    "results": [
      {
        "content": "## React Hooks\n\nHooks are functions that let you use state and other React features...",
        "metadata": {
          "source": "react-docs",
          "url": "https://react.dev/reference/hooks",
          "section": "Hooks",
          "type": "text",
          "relevanceScore": 0.95
        }
      }
    ],
    "context": "# Documentation Query Results\n\n**Query**: how to use hooks\n\n...",
    "totalTokens": 2500,
    "truncated": false
  }
}
```

### Endpoints Compatibles

#### `GET /api/mcp/tools`
Liste tous les outils MCP disponibles.

#### `POST /api/mcp/call`
Endpoint legacy pour exécuter des outils (compatibilité ascendante).

## 🔧 Configuration

### Variables d'Environnement

```bash
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/twinmcp

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI (pour embeddings)
OPENAI_API_KEY=sk-...

# Vector Store (Pinecone/Qdrant)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=twinmcp-docs

# Application
NODE_ENV=development
PORT=3000
```

### Structure du Projet

```
TwinMCP-master/
├── app/
│   └── api/
│       └── mcp/
│           ├── resolve-library-id/
│           ├── query-docs/
│           ├── tools/
│           └── call/
├── lib/
│   ├── services/
│   │   ├── library-resolution.service.ts
│   │   ├── vector-search.service.ts
│   │   └── auth.service.ts
│   ├── mcp/
│   │   └── tools/
│   │       ├── resolve-library-id.tool.ts
│   │       └── query-docs.tool.ts
│   └── mcp-tools.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── init-twinmcp.ts
└── README-TwinMCP.md
```

## 🧪 Tests

### Tests Unitaires

```bash
npm test
```

### Tests avec Couverture

```bash
npm run test:coverage
```

### Tests d'Intégration

```bash
# Test de résolution de bibliothèque
curl -X POST http://localhost:3000/api/mcp/resolve-library-id \
  -H "Content-Type: application/json" \
  -H "x-api-key: twinmcp_live_..." \
  -d '{"query": "react", "limit": 3}'

# Test de recherche de documentation
curl -X POST http://localhost:3000/api/mcp/query-docs \
  -H "Content-Type: application/json" \
  -H "x-api-key: twinmcp_live_..." \
  -d '{"library_id": "/react/react", "query": "hooks"}'
```

## 📊 Monitoring

### Logs

Les logs structurés sont envoyés à la console avec les niveaux :
- `info` : Requêtes MCP normales
- `warn` : Situations anormales non bloquantes
- `error` : Erreurs nécessitant investigation

### Métriques

Le système track automatiquement :
- Temps de réponse par outil
- Taux de succès/échec
- Utilisation des quotas
- Cache hit rate

## 🔐 Authentification

### Clés API

Les clés API suivent le format :
- Production : `twinmcp_live_<32_caractères_aleatoires>`
- Test : `twinmcp_test_<32_caractères_aleatoires>`

### Quotas

Par défaut :
- **100 requêtes/minute**
- **10 000 requêtes/jour**

### Rate Limiting

Implémenté avec Redis sliding window pour une gestion précise des quotas.

## 🚀 Déploiement

### Production

1. **Build**
   ```bash
   npm run build:prod
   ```

2. **Migrations**
   ```bash
   npm run twinmcp:migrate
   ```

3. **Démarrage**
   ```bash
   npm start
   ```

### Docker

```bash
docker build -t twinmcp .
docker run -p 3000:3000 --env-file .env twinmcp
```

## 🤝 Contribuer

1. Fork le projet
2. Créer une branche `feature/nouvelle-fonctionnalite`
3. Commit les changements
4. Push vers la branche
5. Créer une Pull Request

## 📝 License

Ce projet est sous licence MIT - voir le fichier LICENSE pour les détails.

## 🔗 Liens Utiles

- [Documentation Architecture](./Architecture/00-Architecture.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)

## 🆘 Support

Pour toute question ou problème :
- Créer une issue sur GitHub
- Contacter l'équipe TwinMCP
- Consulter la documentation dans le dossier `/Architecture`
