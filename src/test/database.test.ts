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
    let testUserId: string;

    beforeEach(async () => {
      // Créer un client de test
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
      testUserId = user.id;

      const retrieved = await DatabaseService.getUserByEmail(userData.email);
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

      const results = await DatabaseService.searchLibraries('Test');
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
      expect(log.toolName).toBe('test-tool');
      expect(log.responseTimeMs).toBe(100);
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
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      const token = await DatabaseService.createOAuthToken(tokenData);
      expect(token.userId).toBe(user.id);
      expect(token.provider).toBe('github');

      const retrieved = await DatabaseService.getOAuthToken(user.id, 'github');
      expect(retrieved?.provider).toBe('github');
    });
  });
});
