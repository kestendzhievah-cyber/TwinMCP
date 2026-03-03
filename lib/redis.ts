import Redis from 'ioredis';

const REDIS_DISABLED =
  process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL;

const globalForRedis = globalThis as unknown as { redis: Redis };

function createRedisClient(): Redis {
  if (REDIS_DISABLED) {
    console.warn('[redis] Redis disabled or REDIS_URL not set — using in-memory mock');
    // Return a lightweight mock that satisfies the Redis interface at runtime.
    // Only the methods actually called by the app are implemented.
    return {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 1,
      exists: async () => 0,
      incr: async () => 1,
      expire: async () => 1,
      ping: async () => 'PONG',
      connect: async () => {},
      quit: async () => {},
      disconnect: async () => {},
      on: function () { return this; },
      status: 'ready',
    } as unknown as Redis;
  }

  try {
    const client = new Redis(
      process.env.REDIS_URL ||
        ({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        } as any)
    );

    client.on('error', (err: Error) => {
      console.error('[redis] Connection error:', err.message);
    });

    return client;
  } catch (error) {
    console.error('[redis] Failed to create client, falling back to mock:', error);
    return createRedisClient();
  }
}

export const redis: Redis =
  globalForRedis.redis || createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
