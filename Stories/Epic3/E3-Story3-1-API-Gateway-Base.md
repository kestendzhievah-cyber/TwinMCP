# Story 3.1: API Gateway de base

## Résumé

**Epic**: 3 - API Gateway et Authentification  
**Story**: 3.1 - API Gateway de base  
**Description**: Mise en place du serveur Fastify/Express avec endpoints MCP  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Créer une API Gateway robuste qui sert de point d'entrée unique pour toutes les requêtes MCP distantes, avec support pour les endpoints principaux, middleware de logging, CORS, et monitoring de santé.

---

## Prérequis

- Epic 1: Infrastructure Core complétée
- Node.js 20+ avec support ES modules
- PostgreSQL configuré
- Redis configuré pour cache

---

## Spécifications Techniques

### 1. Architecture de la Gateway

```typescript
interface APIGatewayConfig {
  server: {
    host: string;
    port: number;
    trustProxy: boolean;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    requestLogging: boolean;
  };
  endpoints: {
    mcp: string;
    oauth: string;
    health: string;
    metrics: string;
  };
  rateLimit: {
    enabled: boolean;
    globalLimit: number;
    windowMs: number;
  };
}
```

### 2. Structure des endpoints

```typescript
// Endpoints principaux
GET  /health              // Health check
GET  /metrics             // Métriques Prometheus
POST /mcp                 // Endpoint MCP principal
POST /mcp/oauth           // Endpoint MCP avec OAuth
GET  /                    // Documentation API

// Endpoints admin (futurs)
GET  /admin/stats         // Statistiques système
POST /admin/keys          // Gestion clés API
```

---

## Tâches Détaillées

### Étape 1: Créer le serveur API avec Fastify

**Objectif**: Mettre en place le serveur HTTP principal avec configuration Fastify

**Actions**:
1. Initialiser le projet Fastify avec plugins nécessaires
2. Configurer les options de serveur (host, port, trust proxy)
3. Mettre en place la gestion des erreurs globale
4. Ajouter le support pour les hooks de cycle de vie

**Implémentation**:
```typescript
// src/gateway/api-gateway.ts
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { APIGatewayConfig } from '../types/gateway.types';

export class APIGateway {
  private server: FastifyInstance;
  private config: APIGatewayConfig;

  constructor(config: APIGatewayConfig) {
    this.config = config;
    this.server = Fastify({
      logger: this.createLoggerConfig(),
      trustProxy: config.server.trustProxy,
      pluginTimeout: 30000,
      bodyLimit: 1048576, // 1MB
      requestTimeout: 30000
    });
    
    this.setupGlobalHooks();
    this.registerPlugins();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private createLoggerConfig() {
    return {
      level: this.config.logging.level,
      prettyPrint: !this.config.logging.structured,
      serializers: {
        req: (request: FastifyRequest) => ({
          method: request.method,
          url: request.url,
          headers: this.sanitizeHeaders(request.headers),
          remoteAddress: request.ip,
          remotePort: request.socket.remotePort
        }),
        res: (reply: FastifyReply) => ({
          statusCode: reply.statusCode,
          responseTime: reply.getResponseTime()
        })
      }
    };
  }

  private sanitizeHeaders(headers: any) {
    const sanitized = { ...headers };
    // Masquer les headers sensibles
    delete sanitized.authorization;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private setupGlobalHooks(): void {
    // Hook onRequest pour logging
    if (this.config.logging.requestLogging) {
      this.server.addHook('onRequest', async (request, reply) => {
        request.log.info('Incoming request', {
          requestId: request.id,
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent']
        });
      });
    }

    // Hook onResponse pour metrics
    this.server.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      
      // Enregistrer les métriques
      this.recordMetrics(request.method, request.url, reply.statusCode, responseTime);
      
      request.log.info('Request completed', {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    });

    // Hook onError pour gestion des erreurs
    this.server.addHook('onError', async (request, reply, error) => {
      request.log.error('Request error', {
        requestId: request.id,
        error: error.message,
        stack: error.stack
      });
    });
  }

  private async registerPlugins(): Promise<void> {
    // CORS
    if (this.config.cors.enabled) {
      await this.server.register(import('@fastify/cors'), {
        origin: this.config.cors.origins,
        credentials: this.config.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
      });
    }

    // Rate limiting global
    if (this.config.rateLimit.enabled) {
      await this.server.register(import('@fastify/rate-limit'), {
        max: this.config.rateLimit.globalLimit,
        timeWindow: this.config.rateLimit.windowMs,
        keyGenerator: (request) => request.ip,
        errorResponseBuilder: (request, context) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded, try again in ${context.ttl} seconds`,
          ttl: context.ttl
        })
      });
    }

    // Helmet pour sécurité
    await this.server.register(import('@fastify/helmet'), {
      contentSecurityPolicy: false, // Désactivé pour API
      crossOriginEmbedderPolicy: false
    });

    // Compression
    await this.server.register(import('@fastify/compress'), {
      threshold: 1024
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.server.get('/health', this.healthCheckHandler.bind(this));
    
    // Metrics endpoint
    this.server.get('/metrics', this.metricsHandler.bind(this));
    
    // Documentation endpoint
    this.server.get('/', this.documentationHandler.bind(this));
    
    // MCP endpoints
    this.server.register(this.registerMCPEndpoints.bind(this), {
      prefix: '/mcp'
    });
  }

  private async healthCheckHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
      const health = await this.getHealthStatus();
      
      if (health.healthy) {
        reply.status(200).send(health);
      } else {
        reply.status(503).send(health);
      }
    } catch (error) {
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  private async metricsHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
      const metrics = await this.getPrometheusMetrics();
      reply.type('text/plain').send(metrics);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to collect metrics' });
    }
  }

  private async documentationHandler(request: FastifyRequest, reply: FastifyReply) {
    reply.send({
      name: 'TwinMCP API Gateway',
      version: '1.0.0',
      description: 'API Gateway for TwinMCP documentation server',
      endpoints: {
        health: 'GET /health',
        metrics: 'GET /metrics',
        mcp: 'POST /mcp',
        mcp_oauth: 'POST /mcp/oauth',
        documentation: 'GET /'
      },
      documentation: 'https://docs.twinmcp.com/api',
      status: 'operational'
    });
  }

  private async registerMCPEndpoints(fastify: FastifyInstance) {
    // Endpoint MCP principal (sera implémenté dans Story 3.2)
    fastify.post('/', async (request, reply) => {
      reply.status(501).send({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'MCP endpoint not implemented yet'
        }
      });
    });

    // Endpoint MCP OAuth (sera implémenté dans Story 3.3)
    fastify.post('/oauth', async (request, reply) => {
      reply.status(501).send({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'OAuth endpoint not implemented yet'
        }
      });
    });
  }

  private setupErrorHandlers(): void {
    // Gestionnaire d'erreurs 404
    this.server.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Gestionnaire d'erreurs global
    this.server.setErrorHandler(async (error, request, reply) => {
      request.log.error(error, 'Unhandled error');
      
      // Ne pas exposer les erreurs internes en production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      reply.status(500).send({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });
  }

  private async getHealthStatus() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      memory: this.checkMemory(),
      uptime: process.uptime()
    };
    
    const healthy = Object.values(checks).every(check => 
      typeof check === 'object' ? check.healthy : true
    );
    
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      checks
    };
  }

  private async checkDatabase() {
    try {
      // Vérifier la connexion PostgreSQL
      const result = await this.server.pg.query('SELECT 1');
      return { healthy: true, latency: '1ms' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private async checkRedis() {
    try {
      // Vérifier la connexion Redis
      const redis = this.server.redis;
      await redis.ping();
      return { healthy: true, latency: '1ms' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private checkMemory() {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal / 1024 / 1024; // MB
    const usedMemory = usage.heapUsed / 1024 / 1024;   // MB
    
    return {
      healthy: totalMemory < 500, // Limite de 500MB
      heap_used: `${usedMemory.toFixed(2)}MB`,
      heap_total: `${totalMemory.toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`
    };
  }

  private async getPrometheusMetrics(): Promise<string> {
    // Sera implémenté avec prom-client dans Story 3.4
    return '# HELP twinmcp_gateway_info API Gateway information\n' +
           '# TYPE twinmcp_gateway_info gauge\n' +
           'twinmcp_gateway_info{version="1.0.0"} 1\n';
  }

  private recordMetrics(method: string, url: string, statusCode: number, responseTime: number) {
    // Sera implémenté avec prom-client dans Story 3.4
    this.server.log.debug('Recording metrics', {
      method,
      url,
      statusCode,
      responseTime
    });
  }

  async start(): Promise<void> {
    try {
      await this.server.listen({
        port: this.config.server.port,
        host: this.config.server.host
      });
      
      this.server.log.info(`API Gateway started on ${this.config.server.host}:${this.config.server.port}`);
    } catch (error) {
      this.server.log.error(error, 'Failed to start API Gateway');
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
      this.server.log.info('API Gateway stopped');
    } catch (error) {
      this.server.log.error(error, 'Error stopping API Gateway');
      throw error;
    }
  }
}
```

**Validation**:
- Tests de démarrage/arrêt du serveur
- Validation des hooks de cycle de vie
- Tests des gestionnaires d'erreurs

---

### Étape 2: Implémenter les endpoints /mcp et /mcp/oauth

**Objectif**: Créer les endpoints principaux pour le protocole MCP

**Actions**:
1. Définir les schémas de requête/réponse MCP
2. Implémenter la validation des messages MCP
3. Ajouter le middleware de transformation
4. Préparer l'intégration avec le serveur MCP core

**Implémentation**:
```typescript
// src/gateway/mcp-endpoints.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCPMessage } from '../types/mcp.types';

export class MCPEndpoints {
  static async register(server: FastifyInstance) {
    // Endpoint MCP principal
    server.post('/', {
      schema: {
        description: 'MCP protocol endpoint',
        body: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', const: '2.0' },
            id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            method: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['jsonrpc', 'method']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jsonrpc: { type: 'string' },
              id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
              result: { type: 'object' },
              error: { type: 'object' }
            }
          }
        }
      }
    }, this.handleMCPRequest.bind(this));

    // Endpoint MCP OAuth
    server.post('/oauth', {
      schema: {
        description: 'MCP OAuth endpoint',
        headers: {
          Authorization: { type: 'string' }
        },
        body: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', const: '2.0' },
            id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            method: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['jsonrpc', 'method']
        }
      }
    }, this.handleMCPOAuthRequest.bind(this));
  }

  private static async handleMCPRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const mcpMessage: MCPMessage = request.body as MCPMessage;
      
      // Validation basique du message MCP
      this.validateMCPMessage(mcpMessage);
      
      // Log de la requête MCP
      request.log.info('MCP request received', {
        method: mcpMessage.method,
        id: mcpMessage.id,
        hasParams: !!mcpMessage.params
      });
      
      // Pour l'instant, retourner une réponse placeholder
      // Sera remplacé par l'intégration avec le serveur MCP core
      reply.send({
        jsonrpc: '2.0',
        id: mcpMessage.id,
        result: {
          message: 'MCP endpoint ready for integration',
          method: mcpMessage.method
        }
      });
      
    } catch (error) {
      request.log.error(error, 'MCP request validation failed');
      
      reply.status(400).send({
        jsonrpc: '2.0',
        id: (request.body as any).id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: error.message
        }
      });
    }
  }

  private static async handleMCPOAuthRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        reply.status(401).send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: 'Missing Authorization header'
          }
        });
        return;
      }
      
      const mcpMessage: MCPMessage = request.body as MCPMessage;
      this.validateMCPMessage(mcpMessage);
      
      request.log.info('MCP OAuth request received', {
        method: mcpMessage.method,
        id: mcpMessage.id,
        authType: authHeader.startsWith('Bearer ') ? 'Bearer' : 'Other'
      });
      
      // Pour l'instant, valider uniquement la présence du token
      // Sera remplacé par l'implémentation OAuth complète
      reply.send({
        jsonrpc: '2.0',
        id: mcpMessage.id,
        result: {
          message: 'OAuth endpoint ready for integration',
          method: mcpMessage.method,
          authenticated: true
        }
      });
      
    } catch (error) {
      request.log.error(error, 'MCP OAuth request validation failed');
      
      reply.status(400).send({
        jsonrpc: '2.0',
        id: (request.body as any).id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: error.message
        }
      });
    }
  }

  private static validateMCPMessage(message: MCPMessage): void {
    if (!message.jsonrpc || message.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    
    if (!message.method || typeof message.method !== 'string') {
      throw new Error('Method is required and must be a string');
    }
    
    if (message.id !== undefined && 
        typeof message.id !== 'string' && 
        typeof message.id !== 'number') {
      throw new Error('ID must be a string or number');
    }
  }
}
```

**Validation**:
- Tests des schémas de validation
- Tests des messages MCP invalides
- Validation des réponses

---

### Étape 3: Ajouter le middleware de logging et CORS

**Objectif**: Implémenter le middleware complet pour le logging structuré et CORS

**Actions**:
1. Créer le service de logging structuré
2. Configurer CORS avec origines autorisées
3. Ajouter le middleware de request tracking
4. Implémenter le logging des erreurs

**Implémentation**:
```typescript
// src/middleware/logging.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export interface LoggingContext {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  apiKey?: string;
}

export class LoggingMiddleware {
  static requestTracker() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Générer un ID unique pour la requête
      const requestId = uuidv4();
      
      // Ajouter le contexte de logging à la requête
      request.loggingContext = {
        requestId,
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: this.extractUserId(request),
        apiKey: this.extractApiKey(request)
      };
      
      // Logger le début de la requête
      request.log.info('Request started', request.loggingContext);
      
      // Mesurer le temps de réponse
      const startTime = Date.now();
      
      // Hook pour logger la fin de la requête
      reply.addHook('onSend', async () => {
        const duration = Date.now() - startTime;
        
        request.log.info('Request completed', {
          ...request.loggingContext,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
          responseSize: reply.raw.getHeader('content-length')
        });
      });
    };
  }

  static errorLogger() {
    return async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      request.log.error('Request error', {
        ...request.loggingContext,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        statusCode: reply.statusCode
      });
    };
  }

  private static extractUserId(request: FastifyRequest): string | undefined {
    // Extraire depuis JWT token ou autre méthode d'auth
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Pour l'instant, placeholder
      return 'user-placeholder';
    }
    return undefined;
  }

  private static extractApiKey(request: FastifyRequest): string | undefined {
    // Extraire depuis header X-API-Key
    return request.headers['x-api-key'] as string;
  }
}

// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    loggingContext?: LoggingContext;
  }
}
```

**Validation**:
- Tests du middleware de logging
- Validation des contextes de requête
- Tests de tracking d'erreurs

---

### Étape 4: Créer le endpoint /health pour monitoring

**Objectif**: Implémenter un health check complet avec tous les composants

**Actions**:
1. Créer le service de health checking
2. Implémenter les vérifications de dépendances
3. Ajouter les métriques détaillées
4. Configurer les seuils d'alerte

**Implémentation**:
```typescript
// src/services/health-check.service.ts
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
  details?: any;
  lastChecked: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export class HealthCheckService {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private thresholds = {
    responseTime: 1000, // ms
    memoryUsage: 80,    // %
    cpuUsage: 80       // %
  };

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Check base du serveur
    this.register('server', this.checkServer.bind(this));
    
    // Check mémoire
    this.register('memory', this.checkMemory.bind(this));
    
    // Check CPU
    this.register('cpu', this.checkCPU.bind(this));
    
    // Check disque
    this.register('disk', this.checkDisk.bind(this));
  }

  register(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  async runAllChecks(): Promise<HealthStatus> {
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const startTime = Date.now();
          const result = await checkFn();
          result.latency = Date.now() - startTime;
          return result;
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            message: error.message,
            lastChecked: new Date()
          };
        }
      }
    );

    const results = await Promise.allSettled(checkPromises);
    const checks = results
      .filter((result): result is PromiseFulfilledResult<HealthCheck> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    // Calculer le statut global
    const summary = this.calculateSummary(checks);
    const globalStatus = this.determineGlobalStatus(summary);

    return {
      status: globalStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
      summary
    };
  }

  private calculateSummary(checks: HealthCheck[]) {
    return {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length
    };
  }

  private determineGlobalStatus(summary: any): 'healthy' | 'unhealthy' | 'degraded' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    }
    if (summary.degraded > 0) {
      return 'degraded';
    }
    return 'healthy';
  }

  private async checkServer(): Promise<HealthCheck> {
    return {
      name: 'server',
      status: 'healthy',
      message: 'Server running normally',
      lastChecked: new Date(),
      details: {
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  private async checkMemory(): Promise<HealthCheck> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (usagePercent > 90) {
      status = 'unhealthy';
    } else if (usagePercent > 80) {
      status = 'degraded';
    }

    return {
      name: 'memory',
      status,
      message: `Memory usage: ${usagePercent.toFixed(1)}%`,
      lastChecked: new Date(),
      details: {
        heap_used: `${heapUsedMB.toFixed(2)}MB`,
        heap_total: `${heapTotalMB.toFixed(2)}MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
        usage_percent: usagePercent.toFixed(1)
      }
    };
  }

  private async checkCPU(): Promise<HealthCheck> {
    // Pour l'instant, placeholder - nécessitera un module comme cpu-usage
    const cpuUsage = process.cpuUsage();
    
    return {
      name: 'cpu',
      status: 'healthy',
      message: 'CPU usage normal',
      lastChecked: new Date(),
      details: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  private async checkDisk(): Promise<HealthCheck> {
    // Pour l'instant, placeholder - nécessitera un module comme diskusage
    return {
      name: 'disk',
      status: 'healthy',
      message: 'Disk space sufficient',
      lastChecked: new Date(),
      details: {
        // Sera implémenté avec vérification réelle du disque
        free: 'N/A',
        total: 'N/A',
        usage_percent: 'N/A'
      }
    };
  }
}
```

**Validation**:
- Tests de tous les checks de santé
- Validation des seuils
- Tests du statut global

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── gateway/
│   ├── api-gateway.ts
│   ├── mcp-endpoints.ts
│   └── index.ts
├── middleware/
│   ├── logging.middleware.ts
│   ├── cors.middleware.ts
│   └── index.ts
├── services/
│   ├── health-check.service.ts
│   └── metrics.service.ts
├── types/
│   ├── gateway.types.ts
│   └── health.types.ts
└── config/
    └── gateway.config.ts
```

### Configuration

```typescript
// config/gateway.config.ts
export const gatewayConfig: APIGatewayConfig = {
  server: {
    host: process.env.GATEWAY_HOST || '0.0.0.0',
    port: parseInt(process.env.GATEWAY_PORT || '3000'),
    trustProxy: process.env.TRUST_PROXY === 'true'
  },
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    structured: process.env.LOG_STRUCTURED === 'true',
    requestLogging: process.env.LOG_REQUESTS !== 'false'
  },
  endpoints: {
    mcp: '/mcp',
    oauth: '/mcp/oauth',
    health: '/health',
    metrics: '/metrics'
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    globalLimit: parseInt(process.env.RATE_LIMIT_GLOBAL || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  }
};
```

---

## Tests

### Tests unitaires

```typescript
// __tests__/gateway/api-gateway.test.ts
describe('APIGateway', () => {
  let gateway: APIGateway;
  let config: APIGatewayConfig;

  beforeEach(() => {
    config = {
      server: { host: 'localhost', port: 0, trustProxy: false },
      cors: { enabled: true, origins: ['*'], credentials: false },
      logging: { level: 'error', structured: false, requestLogging: false },
      endpoints: { mcp: '/mcp', oauth: '/mcp/oauth', health: '/health', metrics: '/metrics' },
      rateLimit: { enabled: false, globalLimit: 100, windowMs: 60000 }
    };
    gateway = new APIGateway(config);
  });

  test('should start server successfully', async () => {
    await gateway.start();
    expect(gateway.server.server.listening).toBe(true);
    await gateway.stop();
  });

  test('should handle health check', async () => {
    await gateway.start();
    
    const response = await fetch(`http://localhost:${gateway.server.server.address().port}/health`);
    expect(response.ok).toBe(true);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
    
    await gateway.stop();
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/gateway.integration.test.ts
describe('Gateway Integration', () => {
  test('should handle MCP request flow', async () => {
    const gateway = new APIGateway(gatewayConfig);
    await gateway.start();
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };
    
    const response = await fetch(`http://localhost:${gatewayConfig.server.port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest)
    });
    
    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.id).toBe(1);
    
    await gateway.stop();
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de réponse**: < 50ms pour /health, < 100ms pour /mcp
- **Connexions simultanées**: 1000+
- **Memory usage**: < 200MB
- **CPU usage**: < 20% normal

### Optimisations

1. **Connection pooling** pour base de données
2. **Response caching** pour health checks
3. **Compression gzip** pour les réponses
4. **Async operations** pour tous les I/O

---

## Monitoring et Logging

### Logs structurés

```typescript
// Exemple de log structuré
{
  "level": "info",
  "time": "2025-01-10T12:00:00.000Z",
  "pid": 12345,
  "hostname": "api-gateway-1",
  "reqId": "req_abc123",
  "req": {
    "method": "POST",
    "url": "/mcp",
    "headers": { "content-type": "application/json" },
    "remoteAddress": "192.168.1.100"
  },
  "msg": "MCP request received",
  "method": "tools/list",
  "hasParams": false
}
```

### Métriques Prometheus

```typescript
// Sera implémenté dans Story 3.4
const gatewayMetrics = {
  httpRequestsTotal: new Counter({
    name: 'gateway_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
  }),
  
  httpRequestDuration: new Histogram({
    name: 'gateway_http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
  })
};
```

---

## Dépendances

### Packages requis

```json
{
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/rate-limit": "^9.0.0",
    "@fastify/helmet": "^11.1.0",
    "@fastify/compress": "^7.0.0",
    "winston": "^3.11.0",
    "uuid": "^9.0.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0"
  }
}
```

---

## Risques et Mitigations

### Risques identifiés

1. **Memory leak** → Monitoring et garbage collection
2. **Connection exhaustion** → Rate limiting et timeouts
3. **CORS misconfiguration** → Tests rigoureux
4. **Logging performance impact** → Async logging

### Stratégies de mitigation

1. **Health checks** toutes les 30 secondes
2. **Graceful shutdown** avec SIGTERM
3. **Circuit breakers** pour services externes
4. **Log rotation** pour éviter la saturation disque

---

## Livrables

1. **API Gateway fonctionnelle** avec Fastify
2. **Endpoints MCP** (/mcp, /mcp/oauth) opérationnels
3. **Middleware complet** (logging, CORS, rate limiting)
4. **Health check** détaillé
5. **Documentation** API complète
6. **Tests** unitaires et d'intégration

---

## Critères d'Achèvement

✅ Le serveur Fastify démarre et écoute sur le port configuré  
✅ Les endpoints /health et /metrics répondent correctement  
✅ Les endpoints MCP acceptent les requêtes JSON-RPC  
✅ Le middleware CORS fonctionne avec les origines configurées  
✅ Le logging structuré capture toutes les requêtes  
✅ Les health checks vérifient toutes les dépendances  
✅ Les tests passent avec > 90% de couverture  
✅ La documentation API est accessible et complète  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 3-4 jours
- **Assigné à**: À définir
- **Réviseur**: À définir
