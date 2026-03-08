import Redis from 'ioredis';

const REDIS_DISABLED =
  process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL;

const globalForRedis = globalThis as unknown as { redis: Redis };

function createRedisClient(): Redis {
  if (REDIS_DISABLED) {
    console.warn('[redis] Redis disabled or REDIS_URL not set — using in-memory mock');
    // Return a lightweight mock that satisfies the Redis interface at runtime.
    // Only the methods actually called by the app are implemented.
    // Build a chainable pipeline/multi mock that collects commands and
    // returns plausible default results on exec().
    function createChainableMock() {
      const commands: (() => [null, any])[] = [];
      const chain: Record<string, (...args: any[]) => any> = {};
      const methods = ['get', 'set', 'setex', 'del', 'incr', 'decr', 'expire',
        'zadd', 'zcard', 'zremrangebyscore', 'llen', 'hset', 'hget'];
      for (const m of methods) {
        chain[m] = (..._args: any[]) => {
          const defaultVal = m === 'incr' ? 1 : m === 'zcard' ? 0 : m === 'llen' ? 0 : 'OK';
          commands.push(() => [null, defaultVal]);
          return chain;
        };
      }
      chain.exec = async () => commands.map(fn => fn());
      return chain;
    }

    return {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 1,
      exists: async () => 0,
      incr: async () => 1,
      decr: async () => 0,
      expire: async () => 1,
      ping: async () => 'PONG',
      connect: async () => {},
      quit: async () => {},
      disconnect: async () => {},
      on: function () { return this; },
      status: 'ready',
      pipeline: () => createChainableMock(),
      multi: () => createChainableMock(),
      llen: async () => 0,
      zadd: async () => 0,
      zcard: async () => 0,
      zremrangebyscore: async () => 0,
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
