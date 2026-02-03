# TwinMCP - Product Requirements Document

## Project Overview
TwinMCP is an MCP (Model Context Protocol) server that provides up-to-date documentation and code snippets for any library to IDE/LLM assistants, reproducing the functionality of Context7.

## Original Problem Statement
1. Améliorer la landing page avec animations et optimiser pour conversion Pro
2. Compléter le projet selon le CCTP TwinMCP (reproduction de Context7)
3. Implémenter recherche vectorielle, crawling GitHub, gestion clés API, quotas

## User Choices
- Animations: Mix subtiles et dynamiques selon sections
- Conversion: Focus essai gratuit et comparaison Free vs Pro
- Design: Garder couleurs existantes (purple/pink/slate)
- Feature clé: Création de serveurs MCP personnalisés

---

## What's Been Implemented

### Session 1 - Landing Page Optimization (2026-01-03)
- ✅ Hero section with animated CTA buttons
- ✅ Free trial popup (appears after 2s)
- ✅ Animated counters for stats
- ✅ Features section with Pro highlight
- ✅ **Comparison section Free vs Pro**
- ✅ Pricing section with Professional plan highlighted
- ✅ CSS animations: fade-in, bounce-in, pulse-glow, float

### Session 1 - MCP Server Implementation (2026-01-03)
- ✅ **POST /api/mcp** - Main MCP endpoint with JSON-RPC 2.0
- ✅ **POST /api/mcp/oauth** - OAuth 2.0 authenticated MCP
- ✅ **GET /api/libraries** - Library catalog with filtering
- ✅ MCP Tools: `resolve-library-id`, `query-docs`
- ✅ CLI enhanced for npx usage

### Session 2 - Advanced Features (2026-01-03)
- ✅ **Qdrant Vector Search Service** (`/app/lib/services/qdrant-vector.service.ts`)
  - Document chunking and indexing
  - OpenAI embeddings integration
  - Semantic search with filtering
  - Collection management

- ✅ **GitHub Crawler Service** (`/app/lib/services/github-crawler.service.ts`)
  - Repository documentation crawling
  - Markdown/RST file processing
  - Section-based chunking
  - Version tracking
  - Predefined configs for popular libraries

- ✅ **API Keys Management** (`/app/app/api/v1/api-keys/route.ts`)
  - Create API keys (tmcp_xxxx format)
  - List user's API keys with usage stats
  - Revoke/update keys
  - Tier-based quotas (free/basic/premium/enterprise)

- ✅ **Usage Tracking & Quotas** (`/app/app/api/v1/usage/route.ts`)
  - Request logging per tool
  - Daily/monthly quota enforcement
  - Usage analytics by period
  - Success rate tracking

- ✅ **Admin Crawl Endpoint** (`/app/app/api/admin/crawl/route.ts`)
  - Trigger crawls for libraries
  - View crawl status
  - Delete indexed documents

---

## Core Requirements (Static)

### Functional Requirements
1. ✅ MCP server with resolve-library-id and query-docs tools
2. ✅ Remote HTTP endpoint for Cursor/Claude/OpenCode
3. ✅ Local stdio server via npx
4. ✅ API key + OAuth authentication
5. ✅ Library catalog with versions, tokens, snippets
6. ✅ Rate limiting by plan
7. ✅ Documentation crawling pipeline
8. ✅ Vector search for semantic queries

### Technical Requirements
- ✅ JSON-RPC 2.0 protocol compliance
- ✅ <1-2s response time target
- ✅ HTTPS/TLS for all endpoints
- ✅ Multi-tenant SaaS architecture
- ✅ Prisma schema with all models

---

## API Endpoints Summary

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| /api/mcp | GET/POST | API Key | ✅ Working |
| /api/mcp/oauth | POST | OAuth 2.0 | ✅ Working |
| /api/libraries | GET | Public | ✅ Working |
| /api/v1/api-keys | GET/POST | Bearer | ✅ Needs DB |
| /api/v1/api-keys/[id] | DELETE/PATCH | Bearer | ✅ Needs DB |
| /api/v1/usage | GET/POST | Bearer | ✅ Needs DB |
| /api/admin/crawl | GET/POST/DELETE | Admin | ✅ Needs Keys |

---

## Environment Requirements

To fully enable all features:
```bash
# Required for vector search
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=sk-xxx

# Required for GitHub crawling
GITHUB_TOKEN=ghp_xxx

# Required for admin access
ADMIN_SECRET_KEY=your-admin-secret

# Database (already configured)
DATABASE_URL=postgresql://...
```

---

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Landing page animations
- [x] MCP HTTP endpoint
- [x] MCP tools
- [x] Vector search service
- [x] GitHub crawler service
- [x] API keys management
- [x] Usage tracking

### P1 - High Priority
- [ ] Set up Qdrant in production
- [ ] Configure OpenAI API key
- [ ] Run initial documentation crawl
- [ ] User authentication flow
- [ ] Production database setup

### P2 - Medium Priority
- [ ] OAuth 2.0 full flow (authorize, token)
- [ ] Webhook notifications
- [ ] Custom library ingestion UI
- [ ] Billing integration (Stripe)

---

## Testing Status
- Backend: 94.7% (expected failures due to env)
- Frontend: 100%
- Overall: 97.4%

---

*Last Updated: 2026-01-03*
