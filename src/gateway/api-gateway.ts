import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { APIGatewayConfig } from '../types/gateway.types';
import { HealthCheckService } from '../services/health-check.service';
import { LoggingMiddleware } from '../middleware/logging.middleware';
import { MCPEndpoints } from './mcp-endpoints';
import { OAuthRoutes } from './oauth-routes';
import { OAuthService } from '../services/oauth.service';
import { OAuthConfig } from '../types/oauth.types';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { setupRateLimiting } from '../lib/rate-limiting/integration';

export class APIGateway {
  protected server: FastifyInstance;
  private config: APIGatewayConfig;
  private healthService: HealthCheckService;
  private oauthService: OAuthService;

  constructor(config: APIGatewayConfig) {
    this.config = config;
    this.healthService = new HealthCheckService();
    
    // Initialiser OAuth service
    const oauthConfig: OAuthConfig = {
      authorizationServer: {
        issuer: process.env['OAUTH_ISSUER'] || 'https://api.twinmcp.com',
        authorizationEndpoint: '/oauth/authorize',
        tokenEndpoint: '/oauth/token',
        userInfoEndpoint: '/oauth/userinfo',
        revocationEndpoint: '/oauth/revoke'
      },
      clients: new Map(),
      supportedScopes: ['read', 'write', 'admin', 'openid', 'profile', 'email'],
      tokenConfig: {
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 2592000,
        idTokenLifetime: 3600
      }
    };

    // Initialiser Prisma et Redis (à remplacer avec l'injection de dépendances)
    const prisma = new PrismaClient();
    const redis = createClient();
    
    this.oauthService = new OAuthService(prisma, redis, oauthConfig);
    this.server = Fastify({
      logger: this.createLoggerConfig(),
      trustProxy: config.server.trustProxy,
      pluginTimeout: 30000,
      bodyLimit: 1048576, // 1MB
      requestTimeout: 30000
    });
    
    this.initialize(redis);
  }

  private async initialize(redis: any): Promise<void> {
    this.setupGlobalHooks();
    this.registerPlugins();
    await this.setupRateLimiting(redis);
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  // Getter for test access
  getServer() {
    return this.server;
  }

  private createLoggerConfig() {
    return {
      level: this.config.logging.level
    };
  }

  // TODO: Implement sanitizeHeaders usage in logging
  // private sanitizeHeaders(headers: any) {
  //   const sanitized = { ...headers };
  //   // Masquer les headers sensibles
  //   delete sanitized.authorization;
  //   delete sanitized['x-api-key'];
  //   return sanitized;
  // }

  private async setupRateLimiting(redis: any): Promise<void> {
    try {
      await setupRateLimiting(this.server, redis);
      this.server.log.info('Rate limiting initialized successfully');
    } catch (error) {
      this.server.log.error(error, 'Failed to initialize rate limiting');
    }
  }

  private setupGlobalHooks(): void {
    // Hook onRequest pour logging
    if (this.config.logging.requestLogging) {
      this.server.addHook('onRequest', LoggingMiddleware.requestTracker());
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
      } as any);
    });

    // Hook onError pour gestion des erreurs
    this.server.addHook('onError', async (request, reply, error) => {
      LoggingMiddleware.errorLogger()(error, request, reply);
    });
  }

  private async registerPlugins(): Promise<void> {
    // TODO: Fix plugin version compatibility issues
    // CORS - Temporarily disabled due to version mismatch
    // if (this.config.cors.enabled) {
    //   await this.server.register(import('@fastify/cors'), {
    //     origin: this.config.cors.origins,
    //     credentials: this.config.cors.credentials,
    //     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    //     allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    //   });
    // }

    // Rate limiting global - Temporarily disabled due to version mismatch
    // if (this.config.rateLimit.enabled) {
    //   await this.server.register(import('@fastify/rate-limit'), {
    //     max: this.config.rateLimit.globalLimit,
    //     timeWindow: this.config.rateLimit.windowMs,
    //     keyGenerator: (request) => request.ip,
    //     errorResponseBuilder: (_request, context) => ({
    //       statusCode: 429,
    //       error: 'Too Many Requests',
    //       message: `Rate limit exceeded, try again in ${context.ttl} seconds`,
    //       ttl: context.ttl
    //     })
    //   });
    // }

    // Helmet pour sécurité - Temporarily disabled due to version mismatch
    // await this.server.register(import('@fastify/helmet'), {
    //   contentSecurityPolicy: false, // Désactivé pour API
    //   crossOriginEmbedderPolicy: false
    // });

    // Compression - Temporarily disabled due to version mismatch
    // await this.server.register(import('@fastify/compress'), {
    //   threshold: 1024
    // });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.server.get('/health', this.healthCheckHandler.bind(this));
    
    // Metrics endpoint
    this.server.get('/metrics', this.metricsHandler.bind(this));
    
    // Documentation endpoint
    this.server.get('/', this.documentationHandler.bind(this));
    
    // MCP endpoints
    this.server.register(MCPEndpoints.register.bind(MCPEndpoints), {
      prefix: '/mcp'
    });

    // OAuth endpoints
    this.server.register(OAuthRoutes.register, {
      oauthService: this.oauthService
    });
  }

  private async healthCheckHandler(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const health = await this.healthService.runAllChecks();
      
      if (health.status === 'healthy') {
        reply.status(200).send(health);
      } else {
        reply.status(503).send(health);
      }
    } catch (error) {
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  }

  private async metricsHandler(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const metrics = await this.getPrometheusMetrics();
      reply.type('text/plain').send(metrics);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to collect metrics' });
    }
  }

  private async documentationHandler(_request: FastifyRequest, reply: FastifyReply) {
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

  private setupErrorHandlers(): void {
    // Gestionnaire d'erreurs 404
    this.server.setNotFoundHandler(async (_request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: `Route ${_request.method} ${_request.url} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Gestionnaire d'erreurs global
    this.server.setErrorHandler(async (error, request, reply) => {
      request.log.error(error, 'Unhandled error');
      
      // Ne pas exposer les erreurs internes en production
      const isDevelopment = process.env['NODE_ENV'] === 'development';
      
      reply.status(500).send({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });
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
    } as any);
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
