# TwinMCP - Product Requirements Document

## Project Overview
TwinMCP is an MCP (Model Context Protocol) server that provides up-to-date documentation and code snippets for any library to IDE/LLM assistants, reproducing the functionality of Context7.

## Original Problem Statement
1. Améliorer la landing page avec animations et optimiser pour conversion Pro
2. Compléter le projet selon le CCTP TwinMCP (reproduction de Context7)

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
- ✅ Animated counters for stats (5,000+ devs, 500+ servers, etc.)
- ✅ Features section with Pro highlight
- ✅ **NEW: Comparison section Free vs Pro** with feature table
- ✅ Pricing section with Professional plan highlighted
- ✅ Billing toggle Mensuel/Annuel with -25% badge
- ✅ Testimonials section with ratings
- ✅ Final CTA with urgency messaging
- ✅ CSS animations: fade-in, bounce-in, pulse-glow, float, shimmer

### Session 1 - MCP Server Implementation (2026-01-03)
- ✅ **POST /api/mcp** - Main MCP endpoint with JSON-RPC 2.0
  - `initialize` - Protocol handshake
  - `tools/list` - List available tools
  - `tools/call` - Execute resolve-library-id or query-docs
- ✅ **POST /api/mcp/oauth** - OAuth 2.0 authenticated MCP endpoint
- ✅ **GET /api/libraries** - Library catalog with filtering & pagination
- ✅ MCP Tools:
  - `resolve-library-id` - Find library ID from name
  - `query-docs` - Search documentation for library
- ✅ CLI enhanced with --api-key, --help for npx usage
- ✅ Integration guides for Cursor, Claude Code, OpenCode
- ✅ README.md with comprehensive documentation

---

## Core Requirements (Static)

### Functional Requirements
1. MCP server with resolve-library-id and query-docs tools
2. Remote HTTP endpoint for Cursor/Claude/OpenCode
3. Local stdio server via npx
4. API key + OAuth authentication
5. Library catalog with versions, tokens, snippets
6. Rate limiting by plan (Free: 100/day, Pro: 10,000/day)
7. Documentation crawling and indexing

### Technical Requirements
- JSON-RPC 2.0 protocol compliance
- <1-2s response time for queries
- 99.9% availability target
- HTTPS/TLS for all endpoints
- Multi-tenant SaaS architecture

---

## User Personas

### Developer Dave
- Uses Cursor daily for coding
- Needs up-to-date library docs without hallucinations
- Values quick setup and seamless integration

### Enterprise Emma
- Manages team of 20+ developers
- Needs private libraries support
- Requires SLA and dedicated support

### Startup Steve
- Building MVP fast
- Wants free tier to test
- May upgrade to Pro for more requests

---

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Landing page animations
- [x] Free vs Pro comparison section
- [x] MCP HTTP endpoint
- [x] resolve-library-id tool
- [x] query-docs tool
- [x] CLI for local usage

### P1 - High Priority
- [ ] Real vector database for documentation search
- [ ] Documentation crawling pipeline
- [ ] User authentication flow
- [ ] API key management dashboard
- [ ] Usage tracking & quotas

### P2 - Medium Priority
- [ ] OAuth 2.0 full flow (authorize, token endpoints)
- [ ] Webhook notifications
- [ ] Custom library ingestion
- [ ] Version-specific documentation filtering
- [ ] Admin panel for crawling management

### P3 - Nice to Have
- [ ] Streaming responses
- [ ] Batch queries
- [ ] Library popularity analytics
- [ ] Community contributions
- [ ] White-label options

---

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/mcp | GET | None | Server info |
| /api/mcp | POST | API Key | MCP JSON-RPC |
| /api/mcp/oauth | POST | OAuth | MCP with OAuth |
| /api/libraries | GET | None | Library catalog |

---

## Next Action Items
1. Implement real documentation vector search with Pinecone/Qdrant
2. Set up documentation crawler for GitHub repos
3. Create user dashboard for API key management
4. Add usage tracking with daily/monthly quotas
5. Deploy to production with proper HTTPS

---

## Technical Debt
- Library data is currently static/mocked
- OAuth token validation uses simple JWT (needs proper OAuth flow)
- Rate limiting uses in-memory counters (needs Redis)
- Documentation snippets are generated, not crawled

---

*Last Updated: 2026-01-03*
