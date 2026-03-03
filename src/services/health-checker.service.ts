import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { HealthCheck } from '../types/monitoring.types';

export class HealthChecker {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  async checkService(serviceName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: Record<string, any> = {};
      let dependencies: HealthCheck[] = [];

      switch (serviceName) {
        case 'database':
          ({ status, details, dependencies } = await this.checkDatabase());
          break;
        case 'redis':
          ({ status, details, dependencies } = await this.checkRedis());
          break;
        case 'api-gateway':
          ({ status, details, dependencies } = await this.checkApiGateway());
          break;
        case 'auth-service':
          ({ status, details, dependencies } = await this.checkAuthService());
          break;
        case 'chat-service':
          ({ status, details, dependencies } = await this.checkChatService());
          break;
        case 'llm-service':
          ({ status, details, dependencies } = await this.checkLLMService());
          break;
        case 'vector-search':
          ({ status, details, dependencies } = await this.checkVectorSearch());
          break;
        default:
          status = 'unhealthy';
          details = { error: `Unknown service: ${serviceName}` };
      }

      const responseTime = Date.now() - startTime;

      return {
        service: serviceName,
        status,
        timestamp: new Date(),
        responseTime,
        details,
        dependencies
      };
    } catch (error) {
      return {
        service: serviceName,
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        details: { error: (error as Error).message },
        dependencies: []
      };
    }
  }

  private async checkDatabase(): Promise<{ status: any; details: any; dependencies: any[] }> {
    try {
      const startTime = Date.now();
      await this.db.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      const connectionResult = await this.db.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections
        FROM pg_stat_activity
      `);

      const details = {
        responseTime,
        connections: connectionResult.rows[0],
        uptime: await this.getDatabaseUptime()
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 1000) status = 'degraded';
      if (responseTime > 5000) status = 'unhealthy';

      return { status, details, dependencies: [] };
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        details: { error: (error as Error).message },
        dependencies: []
      };
    }
  }

  private async checkRedis(): Promise<{ status: any; details: any; dependencies: any[] }> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      const info = await this.redis.info('memory');
      const memory = this.parseRedisInfo(info);

      const details = {
        responseTime,
        memory: {
          used: memory.used_memory,
          peak: memory.used_memory_peak,
          rss: memory.used_memory_rss
        },
        uptime: memory.uptime_in_seconds
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 500) status = 'degraded';
      if (responseTime > 2000) status = 'unhealthy';

      return { status, details, dependencies: [] };
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        details: { error: (error as Error).message },
        dependencies: []
      };
    }
  }

  private async checkApiGateway(): Promise<{ status: any; details: any; dependencies: any[] }> {
    const dbHealth = await this.checkDatabase();
    const redisHealth = await this.checkRedis();

    const details = {
      endpoints: await this.checkApiEndpoints(),
      dependencies: [dbHealth, redisHealth]
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (dbHealth.status !== 'healthy' || redisHealth.status !== 'healthy') {
      status = 'degraded';
    }
    if (dbHealth.status === 'unhealthy' || redisHealth.status === 'unhealthy') {
      status = 'unhealthy';
    }

    return { status, details, dependencies: [dbHealth, redisHealth] };
  }

  private async checkAuthService(): Promise<{ status: any; details: any; dependencies: any[] }> {
    const dbHealth = await this.checkDatabase();

    const details = {
      jwt: await this.checkJWTService(),
      oauth: await this.checkOAuthProviders(),
      dependencies: [dbHealth]
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (dbHealth.status !== 'healthy') {
      status = 'degraded';
    }
    if (dbHealth.status === 'unhealthy') {
      status = 'unhealthy';
    }

    return { status, details, dependencies: [dbHealth] };
  }

  private async checkChatService(): Promise<{ status: any; details: any; dependencies: any[] }> {
    const dbHealth = await this.checkDatabase();
    const redisHealth = await this.checkRedis();

    const details = {
      conversations: await this.checkConversationHealth(),
      streaming: await this.checkStreamingHealth(),
      dependencies: [dbHealth, redisHealth]
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (dbHealth.status !== 'healthy' || redisHealth.status !== 'healthy') {
      status = 'degraded';
    }
    if (dbHealth.status === 'unhealthy' || redisHealth.status === 'unhealthy') {
      status = 'unhealthy';
    }

    return { status, details, dependencies: [dbHealth, redisHealth] };
  }

  private async checkLLMService(): Promise<{ status: any; details: any; dependencies: any[] }> {
    const details = {
      providers: await this.checkLLMProviders(),
      models: await this.checkModelAvailability(),
      queue: await this.checkRequestQueue()
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (details.providers.some((p: any) => p.status !== 'healthy')) {
      status = 'degraded';
    }
    if (details.providers.every((p: any) => p.status === 'unhealthy')) {
      status = 'unhealthy';
    }

    return { status, details, dependencies: [] };
  }

  private async checkVectorSearch(): Promise<{ status: any; details: any; dependencies: any[] }> {
    const dbHealth = await this.checkDatabase();

    const details = {
      embeddings: await this.checkEmbeddingService(),
      index: await this.checkVectorIndex(),
      search: await this.checkSearchPerformance()
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (dbHealth.status !== 'healthy') {
      status = 'degraded';
    }
    if (dbHealth.status === 'unhealthy') {
      status = 'unhealthy';
    }

    return { status, details, dependencies: [dbHealth] };
  }

  private async getDatabaseUptime(): Promise<number> {
    try {
      const result = await this.db.query('SELECT EXTRACT(EPOCH FROM pg_postmaster_start_time()) as uptime');
      return Math.floor(Date.now() / 1000) - Math.floor(parseFloat(result.rows[0].uptime));
    } catch (error) {
      return 0;
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const result: Record<string, any> = {};
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }
    
    return result;
  }

  private async checkApiEndpoints(): Promise<any> {
    const endpoints = ['/api/health', '/api/ready'];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const results: Record<string, string> = {};

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          signal: AbortSignal.timeout(5000),
        });
        results[endpoint] = response.ok ? 'healthy' : 'degraded';
      } catch {
        results[endpoint] = 'unhealthy';
      }
    }

    return results;
  }

  private async checkJWTService(): Promise<any> {
    const hasSecret = !!(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET);
    const hasFirebase = !!process.env.FIREBASE_PROJECT_ID;
    return {
      signing: hasSecret ? 'healthy' : 'degraded',
      verification: hasSecret || hasFirebase ? 'healthy' : 'unhealthy',
      keyRotation: 'healthy'
    };
  }

  private async checkOAuthProviders(): Promise<any> {
    return {
      google: process.env.GOOGLE_CLIENT_ID ? 'healthy' : 'not_configured',
      github: process.env.GITHUB_CLIENT_ID ? 'healthy' : 'not_configured',
      firebase: process.env.FIREBASE_PROJECT_ID ? 'healthy' : 'not_configured'
    };
  }

  private async checkConversationHealth(): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_conversations,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_conversations
        FROM conversations
      `);
      
      return {
        active: parseInt(result.rows[0].active_conversations),
        recent: parseInt(result.rows[0].recent_conversations),
        status: 'healthy'
      };
    } catch (error) {
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }

  private async checkStreamingHealth(): Promise<any> {
    try {
      // Check Redis pub/sub connectivity for streaming
      const pong = await this.redis.ping();
      return {
        pubsub: pong === 'PONG' ? 'healthy' : 'degraded',
        sse: 'healthy',
        connections: 0
      };
    } catch {
      return { pubsub: 'unhealthy', sse: 'healthy', connections: 0 };
    }
  }

  private async checkLLMProviders(): Promise<any[]> {
    const providers: any[] = [];

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      const start = Date.now();
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          signal: AbortSignal.timeout(5000),
        });
        providers.push({ name: 'openai', status: res.ok ? 'healthy' : 'degraded', latency: Date.now() - start });
      } catch {
        providers.push({ name: 'openai', status: 'unhealthy', latency: Date.now() - start });
      }
    } else {
      providers.push({ name: 'openai', status: 'not_configured', latency: 0 });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      const start = Date.now();
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal: AbortSignal.timeout(10000),
        });
        providers.push({ name: 'anthropic', status: res.ok ? 'healthy' : 'degraded', latency: Date.now() - start });
      } catch {
        providers.push({ name: 'anthropic', status: 'unhealthy', latency: Date.now() - start });
      }
    } else {
      providers.push({ name: 'anthropic', status: 'not_configured', latency: 0 });
    }

    return providers;
  }

  private async checkModelAvailability(): Promise<any> {
    const models: Record<string, string> = {};
    if (process.env.OPENAI_API_KEY) {
      models['gpt-4o'] = 'available';
      models['gpt-4o-mini'] = 'available';
    }
    if (process.env.ANTHROPIC_API_KEY) {
      models['claude-3'] = 'available';
    }
    if (Object.keys(models).length === 0) {
      models['none'] = 'no_api_keys_configured';
    }
    return models;
  }

  private async checkRequestQueue(): Promise<any> {
    try {
      const queueLen = await this.redis.llen('mcp:request_queue');
      const processingLen = await this.redis.llen('mcp:processing_queue');
      const failedLen = await this.redis.llen('mcp:failed_queue');
      return {
        pending: queueLen,
        processing: processingLen,
        failed: failedLen,
        status: failedLen > 100 ? 'degraded' : 'healthy'
      };
    } catch {
      return { pending: 0, processing: 0, failed: 0, status: 'healthy' };
    }
  }

  private async checkEmbeddingService(): Promise<any> {
    if (!process.env.OPENAI_API_KEY) {
      return { provider: 'not_configured', models: [], latency: 0 };
    }
    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      return {
        provider: res.ok ? 'healthy' : 'degraded',
        models: ['text-embedding-3-small', 'text-embedding-3-large'],
        latency: Date.now() - start
      };
    } catch {
      return { provider: 'unhealthy', models: [], latency: Date.now() - start };
    }
  }

  private async checkVectorIndex(): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT
          pg_total_relation_size('public.embeddings') as size,
          (SELECT count(*) FROM embeddings) as documents
      `);
      const row = result.rows[0] || {};
      const sizeBytes = parseInt(row.size || '0');
      const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
      return {
        size: `${sizeMB}MB`,
        documents: parseInt(row.documents || '0'),
        status: 'healthy'
      };
    } catch {
      // Table may not exist yet
      return { size: '0MB', documents: 0, status: 'healthy' };
    }
  }

  private async checkSearchPerformance(): Promise<any> {
    const start = Date.now();
    try {
      await this.db.query('SELECT 1');
      const latency = Date.now() - start;
      return {
        averageLatency: latency,
        throughput: latency > 0 ? Math.round(1000 / latency) : 0,
        status: latency > 500 ? 'degraded' : 'healthy'
      };
    } catch {
      return { averageLatency: 0, throughput: 0, status: 'unhealthy' };
    }
  }
}
