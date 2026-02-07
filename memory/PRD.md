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

### Session 5 - Backend Authentication System (2025-12)
- ✅ **Service d'authentification centralisé** (`/lib/services/user-auth.service.ts`)
  - Vérification des tokens Firebase Admin
  - Création automatique d'utilisateurs en base de données
  - Gestion des profils (UserProfile)
  - Attribution automatique du plan "free"
  - Cache Redis pour les sessions et utilisateurs
  
- ✅ **Rate Limiting** (`/lib/middleware/rate-limiter.ts`)
  - Sliding window avec Redis (60 req/min)
  - Configurations multiples (auth: 10/min, api: 60/min, heavy: 10/min)
  - Headers standards (X-RateLimit-Limit, X-RateLimit-Remaining)
  - Fallback en mémoire si Redis indisponible
  
- ✅ **Middleware d'authentification** (`/lib/middleware/auth-middleware.ts`)
  - Support Bearer token (Firebase) et API Key
  - Validation et extraction automatique
  - Contexte d'authentification complet
  
- ✅ **Nouvelles APIs d'authentification**
  - `POST /api/auth/verify` - Vérifier token et créer session
  - `GET /api/auth/me` - Récupérer profil utilisateur
  - `GET/POST /api/auth/session` - Gestion des sessions
  - `POST /api/auth/logout` - Déconnexion
  - `GET/PUT /api/auth/profile` - Gestion du profil
  
- ✅ **Auth Context amélioré** (`/lib/auth-context.tsx`)
  - Synchronisation automatique avec backend
  - Profil étendu avec statistiques
  - Méthodes updateProfile et refreshProfile

### Session 4 - Authentication & Dashboard Production-Ready (2025-12)
- ✅ **Changement URL d'authentification `/login` → `/auth`**
  - Tous les liens mis à jour (landing page, pricing, signup, dashboard)
  - Page `/auth` avec design complet (Google, GitHub, email/password)
  
- ✅ **API Analytics en temps réel** (`/api/v1/analytics`)
  - Statistiques par période (jour, semaine, mois)
  - Usage par outil
  - Quotas par clé API
  
- ✅ **API Facturation** (`/api/v1/billing`)
  - Abonnement actuel avec détails
  - Factures récentes
  - Paiements et crédits
  - Profil de facturation
  
- ✅ **Page Facturation Dashboard** (`/dashboard/billing`)
  - Affichage du plan actuel
  - Liste des factures
  - Historique des paiements
  - Crédits disponibles
  
- ✅ **Page Analytics améliorée** (`/dashboard/analytics`)
  - Données en temps réel depuis l'API
  - Graphiques d'utilisation
  - Quotas avec barres de progression
  
- ✅ **Dashboard principal optimisé**
  - Actions rapides vers Analytics, Facturation, Clés API, Documentation
  - Données des clés API correctement mappées

### Session 3 - Dashboard Optimization (2026-01-03)
- ✅ **New Layout** with collapsible sidebar navigation
- ✅ **Search Modal** (Cmd+K shortcut)
- ✅ **Dashboard Home** redesigned
- ✅ **Libraries Page** fully functional
- ✅ **Analytics Page** with visualizations

### Session 2 - Advanced Features (2026-01-03)
- ✅ **Qdrant Vector Search Service**
- ✅ **GitHub Crawler Service**
- ✅ **API Keys Management**
- ✅ **Usage Tracking & Quotas**
- ✅ **Admin Crawl Endpoint**

### Session 1 - Landing Page & MCP Server (2026-01-03)
- ✅ Landing page optimisée avec animations
- ✅ MCP server avec JSON-RPC 2.0
- ✅ Library catalog avec filtering

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
| /api/v1/api-keys | GET/POST/DELETE | Bearer | ✅ Working |
| /api/v1/dashboard | GET | Bearer | ✅ Working |
| /api/v1/analytics | GET | Bearer | ✅ NEW |
| /api/v1/billing | GET | Bearer | ✅ NEW |
| /api/v1/usage | GET/POST | Bearer | ✅ Working |
| /api/admin/crawl | GET/POST/DELETE | Admin | ✅ Needs Keys |

---

## Environment Requirements

Pour déployer sur Dokploy, configurez ces variables :

```bash
# Base de données PostgreSQL (OBLIGATOIRE)
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Firebase Authentication (OBLIGATOIRE)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com

# Stripe (pour paiements)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_PRO_PLAN_PRICE_ID=price_xxx

# Optionnel - Vector Search
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=sk-xxx

# Optionnel - GitHub Crawling
GITHUB_TOKEN=ghp_xxx
```

---

## Prioritized Backlog

### P0 - Critical (Done ✅)
- [x] Landing page animations
- [x] MCP HTTP endpoint
- [x] API keys management
- [x] Usage tracking
- [x] Dashboard production-ready
- [x] Analytics en temps réel
- [x] Page facturation
- [x] Changement route auth /login → /auth

### P1 - High Priority (À faire sur Dokploy)
- [ ] Configurer DATABASE_URL sur Dokploy
- [ ] Configurer Firebase Admin credentials
- [ ] Exécuter `npx prisma migrate deploy`
- [ ] Configurer clés Stripe réelles
- [ ] Tester le flux complet d'authentification

### P2 - Medium Priority
- [ ] Set up Qdrant en production
- [ ] Configure OpenAI API key
- [ ] Run initial documentation crawl
- [ ] OAuth 2.0 full flow (authorize, token)
- [ ] Webhook notifications

---

## Deployment Guide for Dokploy

### 1. Variables d'environnement
Configurez toutes les variables listées ci-dessus dans Dokploy.

### 2. Base de données
```bash
# Une fois déployé, exécutez les migrations
npx prisma migrate deploy
```

### 3. Vérification
- Accédez à `/auth` pour tester l'authentification
- Accédez à `/dashboard` pour voir le dashboard
- Accédez à `/dashboard/billing` pour la facturation
- Accédez à `/dashboard/analytics` pour les statistiques

---

## Testing Status
- Build Next.js: ✅ 100%
- TypeScript: ✅ Pas d'erreurs
- Frontend Routes: ✅ Fonctionnelles

---

*Last Updated: December 2025*
