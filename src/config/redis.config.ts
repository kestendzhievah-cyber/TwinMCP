import { logger } from '../utils/logger';
import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  connectTimeout: number;
  lazyConnect: boolean;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

export const defaultRedisConfig: RedisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379'),
  password: process.env['REDIS_PASSWORD'],
  database: parseInt(process.env['REDIS_DB'] || '0'),
  connectTimeout: 10000,
  lazyConnect: true,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

export class RedisManager {
  private client: Redis;
  private config: RedisConfig;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...defaultRedisConfig, ...config };
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password || undefined,
      db: this.config.database,
      connectTimeout: this.config.connectTimeout,
      lazyConnect: this.config.lazyConnect,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
    });

    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.client.on('error', (error: any) => {
      logger.error('Redis Client Error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    this.client.on('end', () => {
      logger.info('Redis Client Connection Ended');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  async getInfo(): Promise<Record<string, any>> {
    try {
      const info = await this.client.info();
      const infoLines = info.split('\r\n');
      const infoObj: Record<string, any> = {};

      for (const line of infoLines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoObj[key] = value;
        }
      }

      return {
        connected: true,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        version: (infoObj as any)['redis_version'],
        usedMemory: (infoObj as any)['used_memory_human'],
        connectedClients: (infoObj as any)['connected_clients'],
        uptimeInSeconds: (infoObj as any)['uptime_in_seconds'],
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }
}

// Singleton instance for application-wide use
let redisManager: RedisManager | null = null;

export function getRedisManager(config?: Partial<RedisConfig>): RedisManager {
  if (!redisManager) {
    redisManager = new RedisManager(config);
  }
  return redisManager;
}

export async function initializeRedis(config?: Partial<RedisConfig>): Promise<any> {
  const manager = getRedisManager(config);
  await manager.connect();
  return manager.getClient();
}
