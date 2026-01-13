# E3-Story3-4-Rate-Limiting-Quotas.md

## Epic 3: API Gateway et Authentification

### Story 3.4: Rate limiting et quotas

**Description**: Système de limitation de débit par utilisateur et IP

---

## Objectif

Implémenter un système robuste de rate limiting et de quotas pour protéger l'API Gateway contre les abus et assurer une utilisation équitable des ressources selon les niveaux d'abonnement.

---

## Prérequis

- API Gateway de base (Story 3.1) fonctionnelle
- Service d'authentification API Keys (Story 3.2) intégré
- Redis configuré et opérationnel
- Base de données PostgreSQL avec schéma utilisateur

---

## Spécifications Techniques

### 1. Architecture du Rate Limiting

#### 1.1 Stratégies de Rate Limiting

```typescript
// src/lib/rate-limiting/types.ts
export interface RateLimitConfig {
  windowMs: number;        // Fenêtre de temps en millisecondes
  maxRequests: number;      // Nombre maximum de requêtes
  keyGenerator: string;     // Générateur de clé (ip, user, api-key)
  strategy: 'sliding-window' | 'fixed-window' | 'token-bucket';
}

export interface QuotaConfig {
  daily: number;            // Quota quotidien
  monthly: number;          // Quota mensuel
  burst: number;           // Pic autorisé
  concurrent: number;      // Requêtes simultanées
}

export interface UserQuota {
  userId: string;
  plan: 'free' | 'premium' | 'enterprise';
  quotas: QuotaConfig;
  currentUsage: {
    daily: number;
    monthly: number;
    burst: number;
    concurrent: number;
  };
  resetTimes: {
    daily: Date;
    monthly: Date;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  headers: {
    'X-RateLimit-Limit': string;
    'X-RateLimit-Remaining': string;
    'X-RateLimit-Reset': string;
    'X-RateLimit-Retry-After'?: string;
  };
}
```

#### 1.2 Configuration des Plans

```typescript
// src/lib/rate-limiting/plans.ts
export const QUOTA_PLANS = {
  free: {
    daily: 100,
    monthly: 3000,
    burst: 10,
    concurrent: 2
  },
  premium: {
    daily: 1000,
    monthly: 30000,
    burst: 50,
    concurrent: 10
  },
  enterprise: {
    daily: 10000,
    monthly: 300000,
    burst: 200,
    concurrent: 50
  }
} as const;

export const RATE_LIMIT_CONFIGS = {
  ip: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: 'ip',
    strategy: 'sliding-window' as const
  },
  user: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyGenerator: 'user',
    strategy: 'sliding-window' as const
  },
  api_key: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000,
    keyGenerator: 'api-key',
    strategy: 'sliding-window' as const
  }
} as const;
```

### 2. Implémentation du Service

#### 2.1 Service Rate Limiting

```typescript
// src/lib/rate-limiting/rate-limiting.service.ts
import Redis from 'ioredis';
import { RateLimitConfig, RateLimitResult, UserQuota } from './types';

export class RateLimitingService {
  constructor(
    private redis: Redis,
    private config: RateLimitConfig
  ) {}

  async checkRateLimit(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.config, ...config };
    const key = `rate-limit:${finalConfig.keyGenerator}:${identifier}`;
    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    // Sliding window implementation
    if (finalConfig.strategy === 'sliding-window') {
      return this.checkSlidingWindow(key, finalConfig, now);
    }

    // Token bucket implementation
    if (finalConfig.strategy === 'token-bucket') {
      return this.checkTokenBucket(key, finalConfig, now);
    }

    // Fixed window implementation (fallback)
    return this.checkFixedWindow(key, finalConfig, now);
  }

  private async checkSlidingWindow(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = now - config.windowMs;
    
    // Remove expired entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const current = await this.redis.zcard(key);
    
    if (current >= config.maxRequests) {
      const oldestRequest = await this.redis.zrange(key, 0, 0);
      const resetTime = parseInt(oldestRequest[0]) + config.windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(resetTime),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, resetTime, retryAfter)
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000));

    const remaining = config.maxRequests - current - 1;
    const resetTime = now + config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private async checkTokenBucket(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const bucketKey = `token-bucket:${key}`;
    
    // Get current bucket state
    const bucket = await this.redis.hmget(bucketKey, 'tokens', 'lastRefill');
    
    let tokens = parseInt(bucket[0] || config.maxRequests.toString());
    let lastRefill = parseInt(bucket[1] || '0');
    
    // Refill tokens based on time elapsed
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.maxRequests);
    
    tokens = Math.min(config.maxRequests, tokens + tokensToAdd);
    lastRefill = now;
    
    if (tokens <= 0) {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      const resetTime = now + config.windowMs;

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(resetTime),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, resetTime, retryAfter)
      };
    }

    // Consume one token
    tokens--;
    
    // Update bucket state
    await this.redis.hmset(bucketKey, {
      tokens,
      lastRefill
    });
    await this.redis.expire(bucketKey, Math.ceil(config.windowMs / 1000));

    const remaining = tokens;
    const resetTime = now + config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private async checkFixedWindow(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;
    
    const current = await this.redis.incr(windowKey);
    
    if (current === 1) {
      await this.redis.expire(windowKey, Math.ceil(config.windowMs / 1000));
    }

    if (current > config.maxRequests) {
      const windowEnd = (Math.floor(now / config.windowMs) + 1) * config.windowMs;
      const retryAfter = Math.ceil((windowEnd - now) / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(windowEnd),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, windowEnd, retryAfter)
      };
    }

    const remaining = config.maxRequests - current;
    const resetTime = (Math.floor(now / config.windowMs) + 1) * config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private buildHeaders(
    limit: number,
    remaining: number,
    resetTime: number,
    retryAfter?: number
  ): RateLimitResult['headers'] {
    const headers: RateLimitResult['headers'] = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    };

    if (retryAfter) {
      headers['X-RateLimit-Retry-After'] = retryAfter.toString();
    }

    return headers;
  }
}
```

#### 2.2 Service de Gestion des Quotas

```typescript
// src/lib/rate-limiting/quota.service.ts
import Redis from 'ioredis';
import { UserQuota, QuotaConfig } from './types';
import { QUOTA_PLANS } from './plans';

export class QuotaService {
  constructor(private redis: Redis) {}

  async checkUserQuota(userId: string, plan: keyof typeof QUOTA_PLANS): Promise<{
    allowed: boolean;
    quotas: QuotaConfig;
    usage: any;
    headers: Record<string, string>;
  }> {
    const quotas = QUOTA_PLANS[plan];
    const now = new Date();
    
    // Get current usage
    const usage = await this.getUserUsage(userId);
    
    // Check daily quota
    if (usage.daily >= quotas.daily) {
      const resetTime = this.getNextDailyReset();
      return {
        allowed: false,
        quotas,
        usage,
        headers: {
          'X-Quota-Daily-Limit': quotas.daily.toString(),
          'X-Quota-Daily-Used': usage.daily.toString(),
          'X-Quota-Daily-Reset': resetTime.toISOString(),
          'X-Quota-Exceeded': 'daily'
        }
      };
    }

    // Check monthly quota
    if (usage.monthly >= quotas.monthly) {
      const resetTime = this.getNextMonthlyReset();
      return {
        allowed: false,
        quotas,
        usage,
        headers: {
          'X-Quota-Monthly-Limit': quotas.monthly.toString(),
          'X-Quota-Monthly-Used': usage.monthly.toString(),
          'X-Quota-Monthly-Reset': resetTime.toISOString(),
          'X-Quota-Exceeded': 'monthly'
        }
      };
    }

    // Check concurrent requests
    const concurrent = await this.getConcurrentRequests(userId);
    if (concurrent >= quotas.concurrent) {
      return {
        allowed: false,
        quotas,
        usage,
        headers: {
          'X-Quota-Concurrent-Limit': quotas.concurrent.toString(),
          'X-Quota-Concurrent-Used': concurrent.toString(),
          'X-Quota-Exceeded': 'concurrent'
        }
      };
    }

    return {
      allowed: true,
      quotas,
      usage,
      headers: {
        'X-Quota-Daily-Limit': quotas.daily.toString(),
        'X-Quota-Daily-Used': usage.daily.toString(),
        'X-Quota-Monthly-Limit': quotas.monthly.toString(),
        'X-Quota-Monthly-Used': usage.monthly.toString()
      }
    };
  }

  async incrementUsage(userId: string): Promise<void> {
    const now = new Date();
    const dailyKey = `quota:daily:${userId}:${this.getDateKey(now)}`;
    const monthlyKey = `quota:monthly:${userId}:${this.getMonthKey(now)}`;

    await Promise.all([
      this.redis.incr(dailyKey),
      this.redis.incr(monthlyKey),
      this.redis.expire(dailyKey, 86400), // 24 hours
      this.redis.expire(monthlyKey, 2592000) // 30 days
    ]);
  }

  async startRequest(userId: string): Promise<string> {
    const requestId = `${userId}-${Date.now()}-${Math.random()}`;
    await this.redis.sadd(`concurrent:${userId}`, requestId);
    return requestId;
  }

  async endRequest(userId: string, requestId: string): Promise<void> {
    await this.redis.srem(`concurrent:${userId}`, requestId);
  }

  private async getUserUsage(userId: string): Promise<any> {
    const now = new Date();
    const dailyKey = `quota:daily:${userId}:${this.getDateKey(now)}`;
    const monthlyKey = `quota:monthly:${userId}:${this.getMonthKey(now)}`;

    const [daily, monthly] = await Promise.all([
      this.redis.get(dailyKey),
      this.redis.get(monthlyKey)
    ]);

    return {
      daily: parseInt(daily || '0'),
      monthly: parseInt(monthly || '0')
    };
  }

  private async getConcurrentRequests(userId: string): Promise<number> {
    return this.redis.scard(`concurrent:${userId}`);
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7);
  }

  private getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthlyReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
}
```

### 3. Middleware Fastify

#### 3.1 Middleware Rate Limiting

```typescript
// src/lib/rate-limiting/middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS } from './plans';

export class RateLimitingMiddleware {
  constructor(
    private rateLimitingService: RateLimitingService,
    private quotaService: QuotaService
  ) {}

  ipRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    const result = await this.rateLimitingService.checkRateLimit(
      ip,
      RATE_LIMIT_CONFIGS.ip
    );

    // Set headers
    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  userRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return;

    const result = await this.rateLimitingService.checkRateLimit(
      user.id,
      RATE_LIMIT_CONFIGS.user
    );

    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'User rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  apiKeyRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.apiKey;
    if (!apiKey) return;

    const result = await this.rateLimitingService.checkRateLimit(
      apiKey.id,
      RATE_LIMIT_CONFIGS.api_key
    );

    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'API key rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  quotaCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return;

    const quotaResult = await this.quotaService.checkUserQuota(
      user.id,
      user.plan as keyof typeof QUOTA_PLANS
    );

    Object.entries(quotaResult.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!quotaResult.allowed) {
      reply.code(402).send({
        error: 'Payment Required',
        message: 'Quota exceeded',
        quotaType: quotaResult.headers['X-Quota-Exceeded']
      });
      return reply;
    }

    // Start tracking request
    const requestId = await this.quotaService.startRequest(user.id);
    request.requestId = requestId;

    // Increment usage
    await this.quotaService.incrementUsage(user.id);

    // Clean up on response
    reply.addHook('onSend', async () => {
      if (request.requestId) {
        await this.quotaService.endRequest(user.id, request.requestId);
      }
    });
  };
}
```

### 4. Intégration avec l'API Gateway

#### 4.1 Configuration du Middleware

```typescript
// src/app/middleware.ts
import { FastifyInstance } from 'fastify';
import { RateLimitingMiddleware } from '../lib/rate-limiting/middleware';
import { RateLimitingService } from '../lib/rate-limiting/rate-limiting.service';
import { QuotaService } from '../lib/rate-limiting/quota.service';

export async function setupRateLimiting(fastify: FastifyInstance) {
  const rateLimitingService = new RateLimitingService(
    fastify.redis,
    RATE_LIMIT_CONFIGS.ip
  );
  
  const quotaService = new QuotaService(fastify.redis);
  const middleware = new RateLimitingMiddleware(rateLimitingService, quotaService);

  // Apply IP rate limiting to all requests
  fastify.addHook('preHandler', middleware.ipRateLimit);

  // Apply user/API key rate limiting after authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.user || request.apiKey) {
      await middleware.userRateLimit(request, reply);
      await middleware.apiKeyRateLimit(request, reply);
      await middleware.quotaCheck(request, reply);
    }
  });

  // Store services for later use
  fastify.decorate('rateLimiting', rateLimitingService);
  fastify.decorate('quota', quotaService);
}
```

### 5. Monitoring et Métriques

#### 5.1 Service de Monitoring

```typescript
// src/lib/rate-limiting/monitoring.ts
import Redis from 'ioredis';

export class RateLimitingMonitor {
  constructor(private redis: Redis) {}

  async getRateLimitStats(timeRange: 'hour' | 'day' | 'week'): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topUsers: Array<{ userId: string; requests: number }>;
    topIPs: Array<{ ip: string; requests: number }>;
    averageRPS: number;
  }> {
    const now = Date.now();
    let startTime: number;

    switch (timeRange) {
      case 'hour':
        startTime = now - 3600000;
        break;
      case 'day':
        startTime = now - 86400000;
        break;
      case 'week':
        startTime = now - 604800000;
        break;
    }

    // Get stats from Redis or database
    const stats = await this.redis.hgetall('rate-limit:stats');
    
    return {
      totalRequests: parseInt(stats.totalRequests || '0'),
      blockedRequests: parseInt(stats.blockedRequests || '0'),
      topUsers: await this.getTopUsers(startTime),
      topIPs: await this.getTopIPs(startTime),
      averageRPS: parseFloat(stats.averageRPS || '0')
    };
  }

  async getQuotaUsage(): Promise<Array<{
    userId: string;
    plan: string;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
    percentage: number;
  }>> {
    // Implementation for quota usage reporting
    return [];
  }

  private async getTopUsers(startTime: number): Promise<any[]> {
    // Implementation for top users
    return [];
  }

  private async getTopIPs(startTime: number): Promise<any[]> {
    // Implementation for top IPs
    return [];
  }
}
```

---

## Tâches Détaillées

### 1. Configuration des Plans et Quotas
- [ ] Définir les configurations de quotas par plan
- [ ] Implémenter les stratégies de rate limiting
- [ ] Configurer Redis pour le stockage des compteurs

### 2. Implémentation du Service
- [ ] Créer le service RateLimitingService
- [ ] Implémenter les algorithmes (sliding window, token bucket)
- [ ] Développer le QuotaService pour la gestion des quotas

### 3. Middleware et Intégration
- [ ] Développer les middleware Fastify
- [ ] Intégrer avec l'API Gateway existante
- [ ] Configurer les headers de réponse

### 4. Monitoring et Reporting
- [ ] Implémenter le service de monitoring
- [ ] Créer les endpoints de statistiques
- [ ] Configurer les alertes pour les dépassements

---

## Validation

### Tests Unitaires

```typescript
// __tests__/rate-limiting/rate-limiting.service.test.ts
describe('RateLimitingService', () => {
  let service: RateLimitingService;
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis();
    service = new RateLimitingService(redis, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: 'test',
      strategy: 'sliding-window'
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block requests exceeding limit', async () => {
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        await service.checkRateLimit('user1');
      }

      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });
  });
});
```

### Tests d'Intégration

```typescript
// __tests__/rate-limiting/integration.test.ts
describe('Rate Limiting Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = fastify();
    await setupRateLimiting(app);
  });

  it('should apply rate limiting to API endpoints', async () => {
    // Make multiple requests
    const promises = Array(20).fill(null).map(() => 
      app.inject({ method: 'GET', url: '/api/test' })
    );

    const responses = await Promise.all(promises);
    
    // Some should be blocked
    const blocked = responses.filter(r => r.statusCode === 429);
    expect(blocked.length).toBeGreaterThan(0);

    // Check headers
    const response = responses[0];
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
  });
});
```

---

## Architecture

### Composants Principaux

1. **RateLimitingService**: Gère les algorithmes de rate limiting
2. **QuotaService**: Gère les quotas utilisateur par plan
3. **RateLimitingMiddleware**: Intégration avec Fastify
4. **RateLimitingMonitor**: Monitoring et statistiques

### Flux de Données

```
Request → IP Rate Limit → Auth → User/API Key Rate Limit → Quota Check → API
```

---

## Performance

### Optimisations

- **Redis Pipeline**: Utilisation de pipelines pour les opérations multiples
- **TTL Automatique**: Expiration automatique des clés Redis
- **Sliding Window**: Algorithme optimal pour le rate limiting
- **Cache Local**: Cache en mémoire pour les configurations fréquentes

### Métriques Cibles

- **Latence**: < 5ms pour les vérifications de rate limit
- **Throughput**: > 10,000 requêtes/secondes
- **Memory**: < 100MB pour les structures Redis

---

## Monitoring

### Métriques à Surveiller

- `rate_limit.requests.total`: Nombre total de requêtes
- `rate_limit.requests.blocked`: Requêtes bloquées
- `rate_limit.latency`: Latence des vérifications
- `quota.usage.daily`: Utilisation quotidienne par utilisateur
- `quota.usage.monthly`: Utilisation mensuelle par utilisateur

### Alertes

- Taux de blocage > 5%
- Latence > 10ms
- Utilisation quota > 80%

---

## Dépendances

### Production

- `ioredis`: Client Redis
- `fastify`: Framework web
- `zod`: Validation des schémas

### Développement

- `@types/jest`: Types Jest
- `supertest`: Tests HTTP
- `redis-memory-server`: Redis pour tests

---

## Risques et Mitigations

### Risques

1. **Redis Down**: Perte des compteurs de rate limit
2. **Clock Drift**: Incohérence des fenêtres temporelles
3. **Memory Overflow**: Saturation de Redis

### Mitigations

1. **Fallback**: Mode dégradé si Redis indisponible
2. **NTP**: Synchronisation temps serveur
3. **Cleanup**: Nettoyage régulier des clés expirées

---

## Livrables

1. **Services**: RateLimitingService, QuotaService
2. **Middleware**: Intégration Fastify complète
3. **Monitoring**: Endpoints de statistiques
4. **Documentation**: Guide d'utilisation et configuration
5. **Tests**: Suite de tests unitaires et intégration

---

## Critères de Succès

- [ ] Rate limiting fonctionnel pour IP, utilisateur et API keys
- [ ] Quotas respectés selon les plans (free/premium/enterprise)
- [ ] Headers X-RateLimit-* présents dans toutes les réponses
- [ ] Monitoring et alertes opérationnelles
- [ ] Performance > 10,000 RPS avec latence < 5ms
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Monitoring**: Surveillance des métriques pendant 2 semaines
2. **Ajustements**: Calibration des limites selon l'usage réel
3. **Documentation**: Mise à jour de la documentation utilisateur
4. **Formation**: Équipe ops formée au monitoring

### Évolutions Futures

1. **Rate Limiting Adaptatif**: Ajustement dynamique des limites
2. **Burst Handling**: Gestion avancée des pics de trafic
3. **Geographic Rate Limiting**: Limites par région géographique
4. **Machine Learning**: Prédiction des abus potentiels
