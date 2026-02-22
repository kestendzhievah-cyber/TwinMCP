// @ts-nocheck

// ── In-memory stores ──
let users: any[] = [];
let clients: any[] = [];
let apiKeys: any[] = [];
let libraries: any[] = [];
let usageLogs: any[] = [];
let oauthTokens: any[] = [];
let idSeq = 0;
const nextId = () => `id-${++idSeq}`;

// ── In-memory Redis store ──
let redisStore: Record<string, string> = {};

// ── Mock Prisma ──
const mockPrisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([{ test: 1 }]),
  $on: jest.fn(),
  user: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const u = { id: nextId(), ...data, apiKeys: [] };
      users.push(u);
      return u;
    }),
    findUnique: jest.fn().mockImplementation(async ({ where }) => {
      return users.find(u => u.email === where.email || u.id === where.id) || null;
    }),
  },
  client: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const c = { id: nextId(), ...data };
      clients.push(c);
      return c;
    }),
    findUnique: jest.fn(),
  },
  apiKey: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const k = { id: nextId(), ...data };
      apiKeys.push(k);
      return k;
    }),
    findUnique: jest.fn(),
  },
  library: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const lib = { id: data.id || nextId(), ...data, popularityScore: 0, totalSnippets: 0 };
      libraries.push(lib);
      return lib;
    }),
    findMany: jest.fn().mockImplementation(async ({ where }) => {
      const q = where?.OR?.[0]?.name?.contains?.toLowerCase() || '';
      return libraries.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.displayName.toLowerCase().includes(q)
      );
    }),
  },
  usageLog: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const log = { id: nextId(), ...data };
      usageLogs.push(log);
      return log;
    }),
  },
  oAuthToken: {
    create: jest.fn().mockImplementation(async ({ data }) => {
      const t = { id: nextId(), ...data };
      oauthTokens.push(t);
      return t;
    }),
    findUnique: jest.fn().mockImplementation(async ({ where }) => {
      const { userId, provider } = where.userId_provider || {};
      return oauthTokens.find(t => t.userId === userId && t.provider === provider) || null;
    }),
  },
};

jest.mock('../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
  databaseHealthCheck: jest.fn().mockResolvedValue(true),
}));

jest.mock('../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockImplementation(async (key: string) => redisStore[key] ?? null),
    set: jest.fn().mockImplementation(async (key: string, val: string) => { redisStore[key] = val; return 'OK'; }),
    setex: jest.fn().mockImplementation(async (key: string, _ttl: number, val: string) => { redisStore[key] = val; return 'OK'; }),
    del: jest.fn().mockImplementation(async (key: string) => { delete redisStore[key]; return 1; }),
    exists: jest.fn().mockImplementation(async (key: string) => key in redisStore ? 1 : 0),
    incr: jest.fn().mockImplementation(async (key: string) => {
      const v = parseInt(redisStore[key] || '0') + 1;
      redisStore[key] = v.toString();
      return v;
    }),
    expire: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    connect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn().mockReturnThis(),
  },
  redisSessionClient: {
    ping: jest.fn().mockResolvedValue('PONG'),
    connect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn().mockReturnThis(),
  },
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  redisHealthCheck: jest.fn().mockResolvedValue(true),
  CacheService: {
    get: jest.fn().mockImplementation(async (key: string) => {
      const v = redisStore[key];
      return v ? JSON.parse(v) : null;
    }),
    set: jest.fn().mockImplementation(async (key: string, value: any) => {
      redisStore[key] = JSON.stringify(value);
    }),
    del: jest.fn().mockImplementation(async (key: string) => {
      delete redisStore[key];
    }),
    exists: jest.fn().mockImplementation(async (key: string) => key in redisStore),
    increment: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { connectDatabase, disconnectDatabase, databaseHealthCheck } from '../config/database';
import { connectRedis, disconnectRedis, redisHealthCheck, CacheService } from '../config/redis';
import { DatabaseService } from '../services/database.service';

describe('Database Configuration', () => {
  beforeAll(async () => {
    await connectDatabase();
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await disconnectRedis();
  });

  beforeEach(() => {
    users = [];
    clients = [];
    apiKeys = [];
    libraries = [];
    usageLogs = [];
    oauthTokens = [];
    redisStore = {};
    idSeq = 0;
  });

  describe('PostgreSQL Connection', () => {
    it('should connect to PostgreSQL', async () => {
      const isHealthy = await databaseHealthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should execute raw query', async () => {
      const { prisma } = await import('../config/database');
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toEqual([{ test: 1 }]);
    });
  });

  describe('Redis Connection', () => {
    it('should connect to Redis', async () => {
      const isHealthy = await redisHealthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should set and get values', async () => {
      const { redisClient } = await import('../config/redis');
      await redisClient.set('test:key', 'test:value');
      const value = await redisClient.get('test:key');
      expect(value).toBe('test:value');
      await redisClient.del('test:key');
    });
  });

  describe('Cache Service', () => {
    it('should cache and retrieve objects', async () => {
      const testData = { id: 1, name: 'test' };
      await CacheService.set('test:object', testData);
      const cached = await CacheService.get('test:object');
      expect(cached).toEqual(testData);
      await CacheService.del('test:object');
    });

    it('should handle cache misses', async () => {
      const result = await CacheService.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('should check existence', async () => {
      await CacheService.set('test:exists', true);
      const exists = await CacheService.exists('test:exists');
      expect(exists).toBe(true);
      const notExists = await CacheService.exists('not:exists');
      expect(notExists).toBe(false);
      await CacheService.del('test:exists');
    });
  });

  describe('Database Service', () => {
    let testClientId: string;

    beforeEach(async () => {
      const client = await DatabaseService.createClient({
        name: 'Test Client',
        domain: 'test.example.com',
        apiKeys: {},
        settings: {},
      });
      testClientId = client.id;
    });

    it('should create and retrieve user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        hashedPassword: 'hashed_password',
        clientId: testClientId,
      };

      const user = await DatabaseService.createUser(userData);
      expect(user.email).toBe(userData.email);
      expect(user.id).toBeDefined();

      const retrieved = await DatabaseService.getUserByEmail(userData.email) as any;
      expect(retrieved?.email).toBe(userData.email);
      expect(retrieved?.id).toBe(user.id);
    });

    it('should create API key', async () => {
      const user = await DatabaseService.createUser({
        email: 'apikey@example.com',
        clientId: testClientId,
      });

      const keyData = {
        userId: user.id,
        keyHash: 'test_hash',
        keyPrefix: 'test_',
        name: 'Test Key',
      };

      const apiKey = await DatabaseService.createApiKey(keyData);
      expect(apiKey.userId).toBe(user.id);
      expect(apiKey.keyPrefix).toBe('test_');
    });

    it('should create and search libraries', async () => {
      const libraryData = {
        id: '/test/library',
        name: 'Test Library',
        displayName: 'Test Library Display',
        language: 'javascript',
        ecosystem: 'node',
        clientId: testClientId,
      };

      const library = await DatabaseService.createLibrary(libraryData);
      expect(library.name).toBe('Test Library');

      const results = await DatabaseService.searchLibraries('Test') as any[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Test Library');
    });

    it('should log usage', async () => {
      const logData = {
        toolName: 'test-tool',
        query: 'test query',
        responseTimeMs: 100,
      };

      const log = await DatabaseService.logUsage(logData);
      expect(log!.toolName).toBe('test-tool');
      expect(log!.responseTimeMs).toBe(100);
    });

    it('should create OAuth token', async () => {
      const user = await DatabaseService.createUser({
        email: 'oauth@example.com',
        clientId: testClientId,
      });

      const tokenData = {
        userId: user.id,
        provider: 'github',
        accessToken: 'access_token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const token = await DatabaseService.createOAuthToken(tokenData);
      expect(token.userId).toBe(user.id);
      expect(token.provider).toBe('github');

      const retrieved = await DatabaseService.getOAuthToken(user.id, 'github');
      expect(retrieved?.provider).toBe('github');
    });
  });
});
