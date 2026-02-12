import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app';
import { Pool } from 'pg';

describe('API Key Authentication Integration', () => {
  let app: Express;
  let testAPIKey: string;
  let userId: string;
  let mockPool: Pool;

  beforeAll(async () => {
    // Configuration de la base de données de test
    mockPool = {
      query: jest.fn()
    } as unknown as Pool;

    app = createApp(mockPool);
    
    // Créer un utilisateur de test
    const userResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    userId = userResponse.body.user.id;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key Creation', () => {
    test('should create API key successfully', async () => {
      const response = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          name: 'Test Integration Key',
          tier: 'basic',
          permissions: ['read', 'write']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.api_key.api_key).toMatch(/^twinmcp_[a-zA-Z0-9]{32}$/);
      expect(response.body.api_key.name).toBe('Test Integration Key');
      expect(response.body.api_key.tier).toBe('basic');
      
      testAPIKey = response.body.api_key.api_key;
    });

    test('should reject API key creation without authentication', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          tier: 'basic'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should validate required fields for API key creation', async () => {
      const response = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          tier: 'basic'
          // Missing name
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Missing required fields');
    });
  });

  describe('API Key Validation', () => {
    test('should allow access with valid API key', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-API-Key', testAPIKey)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
    });

    test('should reject access with invalid API key format', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-API-Key', 'invalid-key')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.code).toBe('INVALID_FORMAT');
    });

    test('should reject access with non-existent API key', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('X-API-Key', 'twinmcp_nonexistentkey1234567890abcdef')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    test('should extract API key from Authorization header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
    });

    test('should extract API key from query parameter', async () => {
      const response = await request(app)
        .post(`/mcp?api_key=${testAPIKey}`)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Quota Management', () => {
    test('should track API usage', async () => {
      // Faire plusieurs requêtes pour utiliser le quota
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/mcp')
          .set('X-API-Key', testAPIKey)
          .send({
            jsonrpc: '2.0',
            id: Math.random(),
            method: 'tools/list'
          })
      );

      const responses = await Promise.all(promises);
      
      // Toutes les requêtes devraient réussir
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Vérifier que l'utilisation a été enregistrée
      const usageResponse = await request(app)
        .get(`/api-keys/${testAPIKey}/usage`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.usage_stats.daily_used).toBeGreaterThan(0);
    });

    test('should enforce quota limits', async () => {
      // Simuler une clé avec un quota quotidien faible
      const lowQuotaKey = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          name: 'Low Quota Key',
          tier: 'free' // 100 requêtes par jour
        });

      const apiKey = lowQuotaKey.body.api_key.api_key;

      // Simuler l'utilisation du quota complet
      mockPool.query.mockResolvedValue({
        rows: [{
          daily_used: 100,
          monthly_used: 1000,
          quota_daily: 100,
          quota_monthly: 3000
        }]
      });

      // La prochaine requête devrait être rejetée
      const response = await request(app)
        .post('/mcp')
        .set('X-API-Key', apiKey)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Quota Exceeded');
      expect(response.body.quota_info).toBeDefined();
    });
  });

  describe('API Key Management', () => {
    test('should list user API keys', async () => {
      const response = await request(app)
        .get('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.api_keys)).toBe(true);
      expect(response.body.api_keys.length).toBeGreaterThan(0);
    });

    test('should get specific API key details', async () => {
      // D'abord créer une clé pour obtenir son ID
      const createResponse = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          name: 'Detail Test Key',
          tier: 'basic'
        });

      const keyId = createResponse.body.api_key.id;

      const response = await request(app)
        .get(`/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.api_key.id).toBe(keyId);
      expect(response.body.api_key.name).toBe('Detail Test Key');
    });

    test('should revoke API key', async () => {
      // Créer une clé à révoquer
      const createResponse = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          name: 'To Revoke Key',
          tier: 'basic'
        });

      const keyId = createResponse.body.api_key.id;

      const response = await request(app)
        .delete(`/api-keys/${keyId}/revoke`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');

      // Vérifier que la clé ne fonctionne plus
      const testResponse = await request(app)
        .post('/mcp')
        .set('X-API-Key', createResponse.body.api_key.api_key)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(testResponse.status).toBe(401);
    });

    test('should regenerate API key', async () => {
      // Créer une clé à régénérer
      const createResponse = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${testAPIKey}`)
        .send({
          name: 'To Regenerate Key',
          tier: 'basic'
        });

      const keyId = createResponse.body.api_key.id;
      const originalKey = createResponse.body.api_key.api_key;

      const response = await request(app)
        .post(`/api-keys/${keyId}/regenerate`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.api_key).toMatch(/^twinmcp_[a-zA-Z0-9]{32}$/);
      expect(response.body.api_key).not.toBe(originalKey);

      // L'ancienne clé ne devrait plus fonctionner
      const testResponse = await request(app)
        .post('/mcp')
        .set('X-API-Key', originalKey)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(testResponse.status).toBe(401);

      // La nouvelle clé devrait fonctionner
      const newTestResponse = await request(app)
        .post('/mcp')
        .set('X-API-Key', response.body.api_key)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(newTestResponse.status).toBe(200);
    });
  });

  describe('Usage Analytics', () => {
    test('should get usage statistics', async () => {
      const response = await request(app)
        .get(`/api-keys/${testAPIKey}/usage`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.usage_stats).toBeDefined();
      expect(response.body.usage_stats.daily_used).toBeDefined();
      expect(response.body.usage_stats.daily_limit).toBeDefined();
      expect(response.body.usage_stats.monthly_used).toBeDefined();
      expect(response.body.usage_stats.monthly_limit).toBeDefined();
      expect(response.body.usage_stats.reset_daily).toBeDefined();
      expect(response.body.usage_stats.reset_monthly).toBeDefined();
      expect(Array.isArray(response.body.usage_stats.usage_history)).toBe(true);
    });

    test('should support different usage periods', async () => {
      const dailyResponse = await request(app)
        .get(`/api-keys/${testAPIKey}/usage?period=daily`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      const monthlyResponse = await request(app)
        .get(`/api-keys/${testAPIKey}/usage?period=monthly`)
        .set('Authorization', `Bearer ${testAPIKey}`);

      expect(dailyResponse.status).toBe(200);
      expect(monthlyResponse.status).toBe(200);
      expect(dailyResponse.body.usage_stats.usage_history).toBeDefined();
      expect(monthlyResponse.body.usage_stats.usage_history).toBeDefined();
    });
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (testAPIKey) {
      await request(app)
        .delete(`/api-keys/${testAPIKey}/revoke`)
        .set('Authorization', `Bearer ${testAPIKey}`);
    }
  });
});
