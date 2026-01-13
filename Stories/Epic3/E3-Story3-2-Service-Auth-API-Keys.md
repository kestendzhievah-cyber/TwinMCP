# Story 3.2: Service d'authentification API Keys

## Résumé

**Epic**: 3 - API Gateway et Authentification  
**Story**: 3.2 - Service d'authentification API Keys  
**Description**: Validation des clés API avec gestion des quotas  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Créer un service d'authentification robuste basé sur les clés API qui valide les accès, gère les quotas d'utilisation, et assure la sécurité des endpoints MCP.

---

## Prérequis

- Story 3.1: API Gateway de base complétée
- Base de données PostgreSQL configurée
- Redis configuré pour cache
- Tables API keys créées

---

## Spécifications Techniques

### 1. Schéma des clés API

```typescript
interface APIKey {
  id: string;
  name: string;
  key_hash: string;           // Hash SHA-256 de la clé
  user_id: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  quota_daily: number;        // Quota quotidien
  quota_monthly: number;      // Quota mensuel
  used_daily: number;         // Utilisation quotidienne
  used_monthly: number;       // Utilisation mensuelle
  last_used_at: Date;
  expires_at?: Date;          // Date d'expiration optionnelle
  is_active: boolean;
  permissions: string[];      // Permissions spécifiques
  created_at: Date;
  updated_at: Date;
}

interface APIKeyUsage {
  key_id: string;
  date: string;               // YYYY-MM-DD
  requests_count: number;
  tokens_used: number;
  last_request_at: Date;
}
```

### 2. Configuration des quotas

```typescript
interface QuotaConfig {
  free: {
    daily: 100;
    monthly: 3000;
    rate_limit: 10;           // requêtes/minute
  };
  basic: {
    daily: 1000;
    monthly: 30000;
    rate_limit: 60;
  };
  premium: {
    daily: 10000;
    monthly: 300000;
    rate_limit: 300;
  };
  enterprise: {
    daily: 100000;
    monthly: 3000000;
    rate_limit: 1000;
  };
}
```

---

## Tâches Détaillées

### Étape 1: Implémenter la validation de clés API hashées

**Objectif**: Créer un service sécurisé de validation des clés API

**Actions**:
1. Créer le service `APIKeyService`
2. Implémenter le hachage SHA-256 des clés
3. Ajouter la validation de format
4. Gérer la révocation de clés

**Implémentation**:
```typescript
// src/services/api-key.service.ts
import { Pool } from 'pg';
import { Redis } from 'redis';
import { createHash, randomBytes } from 'crypto';
import { APIKey, APIKeyUsage } from '../types/api-key.types';

export class APIKeyService {
  private db: Pool;
  private redis: Redis;
  private quotaConfig: QuotaConfig;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.quotaConfig = {
      free: { daily: 100, monthly: 3000, rate_limit: 10 },
      basic: { daily: 1000, monthly: 30000, rate_limit: 60 },
      premium: { daily: 10000, monthly: 300000, rate_limit: 300 },
      enterprise: { daily: 100000, monthly: 3000000, rate_limit: 1000 }
    };
  }

  async validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    try {
      // Vérifier le format de la clé
      if (!this.isValidAPIKeyFormat(apiKey)) {
        return {
          valid: false,
          error: 'INVALID_FORMAT',
          message: 'Invalid API key format'
        };
      }

      // Hasher la clé pour la recherche
      const keyHash = this.hashAPIKey(apiKey);

      // Vérifier le cache Redis
      const cacheKey = `api_key:${keyHash}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const cachedKey = JSON.parse(cached);
        if (!cachedKey.is_active) {
          return {
            valid: false,
            error: 'INACTIVE',
            message: 'API key is inactive'
          };
        }
        return {
          valid: true,
          apiKey: cachedKey,
          fromCache: true
        };
      }

      // Rechercher dans la base de données
      const result = await this.db.query(
        `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true`,
        [keyHash]
      );

      if (result.rows.length === 0) {
        return {
          valid: false,
          error: 'NOT_FOUND',
          message: 'API key not found or inactive'
        };
      }

      const apiKeyData = result.rows[0];

      // Vérifier l'expiration
      if (apiKeyData.expires_at && apiKeyData.expires_at < new Date()) {
        return {
          valid: false,
          error: 'EXPIRED',
          message: 'API key has expired'
        };
      }

      // Mettre en cache pour 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(apiKeyData));

      return {
        valid: true,
        apiKey: apiKeyData,
        fromCache: false
      };

    } catch (error) {
      return {
        valid: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal validation error'
      };
    }
  }

  async createAPIKey(data: CreateAPIKeyData): Promise<APIKey> {
    const apiKey = this.generateAPIKey();
    const keyHash = this.hashAPIKey(apiKey);

    const query = `
      INSERT INTO api_keys (
        name, key_hash, user_id, tier, quota_daily, quota_monthly,
        permissions, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.name,
      keyHash,
      data.user_id,
      data.tier,
      this.quotaConfig[data.tier].daily,
      this.quotaConfig[data.tier].monthly,
      JSON.stringify(data.permissions || []),
      data.expires_at || null,
      true
    ];

    const result = await this.db.query(query, values);
    const createdKey = result.rows[0];

    // Retourner la clé en clair uniquement lors de la création
    return {
      ...createdKey,
      api_key: apiKey // Uniquement pour la création
    };
  }

  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE api_keys 
       SET is_active = false, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    // Supprimer du cache
    const cacheKey = `api_key:${keyId}`;
    await this.redis.del(cacheKey);

    return result.rowCount > 0;
  }

  async regenerateAPIKey(keyId: string, userId: string): Promise<string> {
    // Vérifier que la clé appartient à l'utilisateur
    const existingKey = await this.db.query(
      'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );

    if (existingKey.rows.length === 0) {
      throw new Error('API key not found');
    }

    // Générer une nouvelle clé
    const newApiKey = this.generateAPIKey();
    const newKeyHash = this.hashAPIKey(newApiKey);

    // Mettre à jour la base de données
    await this.db.query(
      `UPDATE api_keys 
       SET key_hash = $1, updated_at = NOW() 
       WHERE id = $2`,
      [newKeyHash, keyId]
    );

    // Supprimer l'ancienne clé du cache
    const oldCacheKey = `api_key:${existingKey.rows[0].key_hash}`;
    await this.redis.del(oldCacheKey);

    return newApiKey;
  }

  private isValidAPIKeyFormat(apiKey: string): boolean {
    // Format: twinmcp_[a-zA-Z0-9]{32}
    const pattern = /^twinmcp_[a-zA-Z0-9]{32}$/;
    return pattern.test(apiKey);
  }

  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private generateAPIKey(): string {
    const randomPart = randomBytes(16).toString('hex');
    return `twinmcp_${randomPart}`;
  }
}

interface APIKeyValidationResult {
  valid: boolean;
  apiKey?: APIKey;
  error?: string;
  message?: string;
  fromCache?: boolean;
}

interface CreateAPIKeyData {
  name: string;
  user_id: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  permissions?: string[];
  expires_at?: Date;
}

interface QuotaConfig {
  free: { daily: number; monthly: number; rate_limit: number };
  basic: { daily: number; monthly: number; rate_limit: number };
  premium: { daily: number; monthly: number; rate_limit: number };
  enterprise: { daily: number; monthly: number; rate_limit: number };
}
```

**Validation**:
- Tests de validation de format
- Tests de hachage et sécurité
- Tests de révocation

---

### Étape 2: Créer le système de quotas par clé

**Objectif**: Implémenter le suivi et la limitation des quotas d'utilisation

**Actions**:
1. Créer le service `QuotaService`
2. Implémenter le tracking quotidien/mensuel
3. Ajouter la vérification des limites
4. Gérer la réinitialisation des quotas

**Implémentation**:
```typescript
// src/services/quota.service.ts
import { Pool } from 'pg';
import { Redis } from 'redis';
import { APIKey } from '../types/api-key.types';

export class QuotaService {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async checkQuota(apiKey: APIKey): Promise<QuotaCheckResult> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Vérifier le cache Redis pour les compteurs
    const dailyKey = `quota:daily:${apiKey.id}:${today}`;
    const monthlyKey = `quota:monthly:${apiKey.id}:${currentMonth}`;

    const [dailyUsage, monthlyUsage] = await Promise.all([
      this.redis.get(dailyKey).then(val => parseInt(val || '0')),
      this.redis.get(monthlyKey).then(val => parseInt(val || '0'))
    ]);

    const dailyRemaining = Math.max(0, apiKey.quota_daily - dailyUsage);
    const monthlyRemaining = Math.max(0, apiKey.quota_monthly - monthlyUsage);

    const hasQuota = dailyRemaining > 0 && monthlyRemaining > 0;

    return {
      has_quota: hasQuota,
      daily_used: dailyUsage,
      daily_limit: apiKey.quota_daily,
      daily_remaining: dailyRemaining,
      monthly_used: monthlyUsage,
      monthly_limit: apiKey.quota_monthly,
      monthly_remaining: monthlyRemaining,
      reset_daily: this.getNextResetTime('daily'),
      reset_monthly: this.getNextResetTime('monthly')
    };
  }

  async recordUsage(apiKey: APIKey, tokensUsed: number = 0): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const now = new Date();

    const dailyKey = `quota:daily:${apiKey.id}:${today}`;
    const monthlyKey = `quota:monthly:${apiKey.id}:${currentMonth}`;

    // Incrémenter les compteurs dans Redis avec TTL
    const pipeline = this.redis.pipeline();
    
    // Compteur quotidien (expire à minuit)
    pipeline.incr(dailyKey);
    pipeline.expireat(dailyKey, this.getEndOfDayTimestamp());
    
    // Compteur mensuel (expire à la fin du mois)
    pipeline.incr(monthlyKey);
    pipeline.expireat(monthlyKey, this.getEndOfMonthTimestamp());

    await pipeline.exec();

    // Mettre à jour last_used_at dans la base de données
    await this.db.query(
      'UPDATE api_keys SET last_used_at = $1 WHERE id = $2',
      [now, apiKey.id]
    );

    // Enregistrer l'utilisation détaillée (pour analytics)
    await this.recordDetailedUsage(apiKey.id, tokensUsed);
  }

  async getUsageHistory(apiKeyId: string, period: 'daily' | 'monthly', limit: number = 30): Promise<UsageHistoryItem[]> {
    const query = `
      SELECT 
        date,
        requests_count,
        tokens_used,
        last_request_at
      FROM api_key_usage
      WHERE key_id = $1
      ORDER BY date DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [apiKeyId, limit]);
    return result.rows;
  }

  async resetQuota(apiKeyId: string, type: 'daily' | 'monthly' | 'all'): Promise<void> {
    if (type === 'daily' || type === 'all') {
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `quota:daily:${apiKeyId}:${today}`;
      await this.redis.del(dailyKey);
    }

    if (type === 'monthly' || type === 'all') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyKey = `quota:monthly:${apiKeyId}:${currentMonth}`;
      await this.redis.del(monthlyKey);
    }
  }

  private async recordDetailedUsage(apiKeyId: string, tokensUsed: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const query = `
      INSERT INTO api_key_usage (key_id, date, requests_count, tokens_used, last_request_at)
      VALUES ($1, $2, 1, $3, $4)
      ON CONFLICT (key_id, date)
      DO UPDATE SET
        requests_count = api_key_usage.requests_count + 1,
        tokens_used = api_key_usage.tokens_used + $3,
        last_request_at = $4
    `;

    await this.db.query(query, [apiKeyId, today, tokensUsed, now]);
  }

  private getNextResetTime(type: 'daily' | 'monthly'): Date {
    const now = new Date();
    
    if (type === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
  }

  private getEndOfDayTimestamp(): number {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Math.floor(endOfDay.getTime() / 1000);
  }

  private getEndOfMonthTimestamp(): number {
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);
    return Math.floor(endOfMonth.getTime() / 1000);
  }
}

interface QuotaCheckResult {
  has_quota: boolean;
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  monthly_used: number;
  monthly_limit: number;
  monthly_remaining: number;
  reset_daily: Date;
  reset_monthly: Date;
}

interface UsageHistoryItem {
  date: string;
  requests_count: number;
  tokens_used: number;
  last_request_at: Date;
}
```

**Validation**:
- Tests de vérification de quotas
- Tests d'enregistrement d'utilisation
- Tests de réinitialisation

---

### Étape 3: Ajouter le tracking d'utilisation (last_used_at)

**Objectif**: Suivre l'activité des clés API pour analytics et sécurité

**Actions**:
1. Créer le middleware de tracking
2. Implémenter l'enregistrement des requêtes
3. Ajouter les métriques détaillées
4. Optimiser les performances

**Implémentation**:
```typescript
// src/middleware/api-key-tracking.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { APIKeyService } from '../services/api-key.service';
import { QuotaService } from '../services/quota.service';

export class APIKeyTrackingMiddleware {
  constructor(
    private apiKeyService: APIKeyService,
    private quotaService: QuotaService
  ) {}

  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Extraire la clé API
      const apiKey = this.extractAPIKey(request);
      
      if (!apiKey) {
        reply.status(401).send({
          error: 'Unauthorized',
          message: 'API key required'
        });
        return;
      }

      // Valider la clé API
      const validation = await this.apiKeyService.validateAPIKey(apiKey);
      
      if (!validation.valid) {
        reply.status(401).send({
          error: 'Unauthorized',
          message: validation.message,
          code: validation.error
        });
        return;
      }

      // Vérifier les quotas
      const quotaCheck = await this.quotaService.checkQuota(validation.apiKey!);
      
      if (!quotaCheck.has_quota) {
        reply.status(429).send({
          error: 'Quota Exceeded',
          message: 'API quota exceeded',
          quota_info: {
            daily_remaining: quotaCheck.daily_remaining,
            monthly_remaining: quotaCheck.monthly_remaining,
            reset_daily: quotaCheck.reset_daily,
            reset_monthly: quotaCheck.reset_monthly
          }
        });
        return;
      }

      // Ajouter les informations au contexte de la requête
      request.apiKey = validation.apiKey;
      request.quotaInfo = quotaCheck;

      // Enregistrer l'utilisation après la réponse
      reply.addHook('onSend', async () => {
        await this.recordUsage(validation.apiKey!, request, reply);
      });

      // Continuer le traitement
    };
  }

  private extractAPIKey(request: FastifyRequest): string | null {
    // Priorité: Header X-API-Key > Authorization Bearer > Query param
    const headerKey = request.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const queryKey = (request.query as any).api_key;
    if (queryKey) {
      return queryKey;
    }

    return null;
  }

  private async recordUsage(apiKey: APIKey, request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Estimer les tokens utilisés (approximation basée sur la taille de la requête/réponse)
      const tokensUsed = this.estimateTokens(request, reply);
      
      await this.quotaService.recordUsage(apiKey, tokensUsed);
      
      // Logger l'utilisation
      request.log.info('API key usage recorded', {
        key_id: apiKey.id,
        key_name: apiKey.name,
        tier: apiKey.tier,
        endpoint: request.url,
        method: request.method,
        status_code: reply.statusCode,
        tokens_used: tokensUsed,
        response_time: reply.getResponseTime()
      });
      
    } catch (error) {
      request.log.error('Failed to record API key usage', error);
    }
  }

  private estimateTokens(request: FastifyRequest, reply: FastifyReply): number {
    // Approximation simple: 1 token ≈ 4 caractères
    const requestSize = JSON.stringify(request.body || {}).length;
    const responseSize = reply.raw.getHeader('content-length') || 0;
    
    return Math.ceil((requestSize + parseInt(responseSize)) / 4);
  }
}

// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: APIKey;
    quotaInfo?: QuotaCheckResult;
  }
}
```

**Validation**:
- Tests d'extraction de clés API
- Tests de tracking d'utilisation
- Tests de performance

---

### Étape 4: Gérer la révocation de clés

**Objectif**: Implémenter la révocation et la gestion du cycle de vie des clés

**Actions**:
1. Créer les endpoints de gestion
2. Implémenter la révocation immédiate
3. Ajouter la planification d'expiration
4. Gérer le nettoyage des données

**Implémentation**:
```typescript
// src/controllers/api-key.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { APIKeyService } from '../services/api-key.service';
import { QuotaService } from '../services/quota.service';

export class APIKeyController {
  constructor(
    private apiKeyService: APIKeyService,
    private quotaService: QuotaService
  ) {}

  async createKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateAPIKeyData;
      
      // Validation des données
      if (!data.name || !data.user_id || !data.tier) {
        reply.status(400).send({
          error: 'Bad Request',
          message: 'Missing required fields: name, user_id, tier'
        });
        return;
      }

      const apiKey = await this.apiKeyService.createAPIKey(data);
      
      // Retourner la clé en clair uniquement lors de la création
      reply.status(201).send({
        success: true,
        api_key: {
          id: apiKey.id,
          name: apiKey.name,
          api_key: apiKey.api_key, // Uniquement lors de la création
          tier: apiKey.tier,
          quota_daily: apiKey.quota_daily,
          quota_monthly: apiKey.quota_monthly,
          expires_at: apiKey.expires_at,
          permissions: apiKey.permissions,
          created_at: apiKey.created_at
        }
      });
      
    } catch (error) {
      request.log.error('Failed to create API key', error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create API key'
      });
    }
  }

  async listKeys(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.params as any).user_id;
      
      const result = await this.apiKeyService.db.query(
        `SELECT id, name, tier, quota_daily, quota_monthly, used_daily, used_monthly,
                last_used_at, expires_at, is_active, permissions, created_at, updated_at
         FROM api_keys 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      reply.send({
        success: true,
        api_keys: result.rows
      });
      
    } catch (error) {
      request.log.error('Failed to list API keys', error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list API keys'
      });
    }
  }

  async revokeKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const keyId = (request.params as any).key_id;
      const userId = (request.body as any).user_id;
      
      const success = await this.apiKeyService.revokeAPIKey(keyId, userId);
      
      if (success) {
        reply.send({
          success: true,
          message: 'API key revoked successfully'
        });
      } else {
        reply.status(404).send({
          error: 'Not Found',
          message: 'API key not found or access denied'
        });
      }
      
    } catch (error) {
      request.log.error('Failed to revoke API key', error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to revoke API key'
      });
    }
  }

  async regenerateKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const keyId = (request.params as any).key_id;
      const userId = (request.body as any).user_id;
      
      const newApiKey = await this.apiKeyService.regenerateAPIKey(keyId, userId);
      
      reply.send({
        success: true,
        message: 'API key regenerated successfully',
        api_key: newApiKey
      });
      
    } catch (error) {
      if (error.message === 'API key not found') {
        reply.status(404).send({
          error: 'Not Found',
          message: 'API key not found or access denied'
        });
      } else {
        request.log.error('Failed to regenerate API key', error);
        reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to regenerate API key'
        });
      }
    }
  }

  async getKeyUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const keyId = (request.params as any).key_id;
      const period = (request.query as any).period || 'daily';
      const limit = parseInt((request.query as any).limit || '30');
      
      const history = await this.quotaService.getUsageHistory(keyId, period, limit);
      
      reply.send({
        success: true,
        usage_history: history
      });
      
    } catch (error) {
      request.log.error('Failed to get API key usage', error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get usage history'
      });
    }
  }
}
```

**Validation**:
- Tests de CRUD des clés API
- Tests de révocation
- Tests de régénération

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── services/
│   ├── api-key.service.ts
│   └── quota.service.ts
├── middleware/
│   └── api-key-tracking.middleware.ts
├── controllers/
│   └── api-key.controller.ts
├── types/
│   └── api-key.types.ts
└── utils/
    └── crypto.utils.ts
```

### Base de données

```sql
-- Table des clés API
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'basic', 'premium', 'enterprise')),
  quota_daily INTEGER NOT NULL DEFAULT 100,
  quota_monthly INTEGER NOT NULL DEFAULT 3000,
  used_daily INTEGER DEFAULT 0,
  used_monthly INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table d'utilisation des clés API
CREATE TABLE api_key_usage (
  key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requests_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  last_request_at TIMESTAMP,
  PRIMARY KEY (key_id, date)
);

-- Index pour la performance
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tier ON api_keys(tier);
CREATE INDEX idx_api_key_usage_date ON api_key_usage(date);
```

---

## Tests

### Tests unitaires

```typescript
// __tests__/services/api-key.service.test.ts
describe('APIKeyService', () => {
  let service: APIKeyService;
  let mockDB: Pool;
  let mockRedis: Redis;

  beforeEach(() => {
    mockDB = createMockDatabase();
    mockRedis = createMockRedis();
    service = new APIKeyService(mockDB, mockRedis);
  });

  test('should validate correct API key format', async () => {
    const validKey = 'twinmcp_1234567890abcdef1234567890abcdef';
    const result = await service.validateAPIKey(validKey);
    
    expect(result.valid).toBe(true);
  });

  test('should reject invalid API key format', async () => {
    const invalidKey = 'invalid_key';
    const result = await service.validateAPIKey(invalidKey);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_FORMAT');
  });

  test('should hash API key correctly', () => {
    const apiKey = 'twinmcp_1234567890abcdef1234567890abcdef';
    const hash = service.hashAPIKey(apiKey);
    
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(apiKey);
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/api-key-auth.integration.test.ts
describe('API Key Authentication Integration', () => {
  let app: FastifyInstance;
  let testAPIKey: string;

  beforeAll(async () => {
    app = await createTestApp();
    
    // Créer une clé API de test
    const response = await app.inject({
      method: 'POST',
      url: '/api-keys',
      payload: {
        name: 'Test Key',
        user_id: 'test-user-id',
        tier: 'basic'
      }
    });
    
    testAPIKey = response.json().api_key.api_key;
  });

  test('should allow access with valid API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'X-API-Key': testAPIKey
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  test('should reject access with invalid API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'X-API-Key': 'invalid-key'
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });

    expect(response.statusCode).toBe(401);
  });

  test('should enforce quota limits', async () => {
    // Simuler l'utilisation du quota
    // ... implémentation du test
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de validation**: < 10ms (cache), < 50ms (DB)
- **Cache hit rate**: > 80%
- **Concurrent validations**: 1000+/s
- **Memory usage**: < 100MB

### Optimisations

1. **Redis cache** pour les clés validées
2. **Connection pooling** PostgreSQL
3. **Async operations** pour le tracking
4. **Batch updates** pour les statistiques

---

## Monitoring et Logging

### Logs structurés

```typescript
logger.info('API key validation', {
  key_id: apiKey.id,
  tier: apiKey.tier,
  endpoint: request.url,
  quota_remaining: quotaInfo.daily_remaining,
  validation_time_ms: validationTime,
  cache_hit: fromCache
});
```

### Métriques

```typescript
export const APIKeyMetrics = {
  validationsTotal: new Counter('api_key_validations_total'),
  validationDuration: new Histogram('api_key_validation_duration_seconds'),
  cacheHitRate: new Gauge('api_key_cache_hit_rate'),
  quotaExceeded: new Counter('api_key_quota_exceeded_total'),
  activeKeys: new Gauge('api_key_active_count')
};
```

---

## Sécurité

### Mesures de sécurité

1. **Hachage SHA-256** des clés API
2. **Format prédéfini** des clés
3. **Expiration automatique** des clés
4. **Rate limiting** par clé
5. **Audit trail** complet

### Best practices

- Ne jamais stocker les clés en clair
- Utiliser HTTPS obligatoirement
- Révoquer immédiatement les clés compromises
- Implémenter la rotation des clés

---

## Livrables

1. **Service d'authentification** complet et sécurisé
2. **Système de quotas** avec tracking détaillé
3. **Middleware de tracking** performant
4. **Endpoints de gestion** CRUD complets
5. **Documentation** API détaillée
6. **Tests** unitaires et d'intégration

---

## Critères d'Achèvement

✅ Les clés API sont validées sécuritairement  
✅ Les quotas sont respectés et trackés  
✅ L'utilisation est enregistrée en temps réel  
✅ La révocation fonctionne immédiatement  
✅ Les performances respectent les cibles  
✅ Les logs et métriques sont complets  
✅ La sécurité est robuste  
✅ Les tests passent avec > 90% de couverture  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 4-5 jours
- **Assigné à**: À définir
- **Réviseur**: À définir
