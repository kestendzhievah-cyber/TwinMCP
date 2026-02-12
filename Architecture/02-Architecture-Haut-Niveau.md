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
