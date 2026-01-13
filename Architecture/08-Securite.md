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
