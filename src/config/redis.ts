import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Configuration Redis
const baseRedisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379'),
  db: parseInt(process.env['REDIS_DB'] || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
};

// Filtrer les propriétés undefined
const redisConfig = process.env['REDIS_PASSWORD'] 
  ? { ...baseRedisConfig, password: process.env['REDIS_PASSWORD'] }
  : baseRedisConfig;

// Client principal pour le cache
export const redisClient = new Redis(redisConfig);

// Client pour les sessions (DB séparée)
const sessionConfig = {
  ...redisConfig,
  db: parseInt(process.env['REDIS_SESSION_DB'] || '1'),
};

export const redisSessionClient = new Redis(sessionConfig);

// Gestion des événements Redis
redisClient.on('connect', () => {
  logger.info('Connected to Redis (cache)');
});

redisClient.on('error', (error) => {
  logger.error('Redis connection error (cache):', error);
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed (cache)');
});

redisSessionClient.on('connect', () => {
  logger.info('Connected to Redis (sessions)');
});

redisSessionClient.on('error', (error) => {
  logger.error('Redis connection error (sessions):', error);
});

// Fonctions utilitaires
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    await redisSessionClient.connect();
    logger.info('Redis clients connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    await redisSessionClient.quit();
    logger.info('Redis clients disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
    throw error;
  }
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  try {
    await redisClient.ping();
    await redisSessionClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Utilitaires de cache
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  static async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await redisClient.incr(key);
      if (ttl) {
        await redisClient.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }
}
