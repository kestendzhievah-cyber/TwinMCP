import { APIKeyService } from '../../src/services/api-key.service';
import { Pool } from 'pg';
import { APIKey, CreateAPIKeyData } from '../../src/types/api-key.types';

// Mock du Pool PostgreSQL
const mockPool = {
  query: jest.fn()
} as unknown as Pool;

describe('APIKeyService', () => {
  let service: APIKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new APIKeyService(mockPool);
  });

  describe('validateAPIKey', () => {
    test('should reject invalid API key format', async () => {
      const invalidKey = 'invalid_key';
      
      const result = await service.validateAPIKey(invalidKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_FORMAT');
      expect(result.message).toBe('Invalid API key format');
    });

    test('should accept valid API key format', async () => {
      const validKey = 'twinmcp_1234567890abcdef1234567890abcdef';
      const mockApiKey = {
        id: 'key-id',
        name: 'Test Key',
        key_hash: 'hash',
        user_id: 'user-id',
        tier: 'basic',
        quota_daily: 1000,
        quota_monthly: 30000,
        used_daily: 0,
        used_monthly: 0,
        last_used_at: new Date(),
        is_active: true,
        permissions: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query = jest.fn().mockResolvedValue({
        rows: [mockApiKey]
      });

      const result = await service.validateAPIKey(validKey);
      
      expect(result.valid).toBe(true);
      expect(result.apiKey).toEqual(mockApiKey);
      expect(result.fromCache).toBe(false);
    });

    test('should reject expired API key', async () => {
      const validKey = 'twinmcp_1234567890abcdef1234567890abcdef';
      const expiredKey = {
        id: 'key-id',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        is_active: true
      };

      mockPool.query = jest.fn().mockResolvedValue({
        rows: [expiredKey]
      });

      const result = await service.validateAPIKey(validKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EXPIRED');
      expect(result.message).toBe('API key has expired');
    });

    test('should reject inactive API key', async () => {
      const validKey = 'twinmcp_1234567890abcdef1234567890abcdef';
      
      mockPool.query = jest.fn().mockResolvedValue({
        rows: []
      });

      const result = await service.validateAPIKey(validKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
      expect(result.message).toBe('API key not found or inactive');
    });
  });

  describe('createAPIKey', () => {
    test('should create API key successfully', async () => {
      const createData: CreateAPIKeyData = {
        name: 'Test Key',
        user_id: 'user-id',
        tier: 'basic',
        permissions: ['read']
      };

      const mockCreatedKey = {
        id: 'key-id',
        name: 'Test Key',
        key_hash: 'hash',
        user_id: 'user-id',
        tier: 'basic',
        quota_daily: 1000,
        quota_monthly: 30000,
        used_daily: 0,
        used_monthly: 0,
        last_used_at: null,
        expires_at: null,
        is_active: true,
        permissions: ['read'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query = jest.fn().mockResolvedValue({
        rows: [mockCreatedKey]
      });

      const result = await service.createAPIKey(createData);
      
      expect(result.name).toBe('Test Key');
      expect(result.tier).toBe('basic');
      expect(result.api_key).toMatch(/^twinmcp_[a-zA-Z0-9]{32}$/);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          'Test Key',
          expect.any(String), // key_hash
          'user-id',
          'basic',
          1000, // quota_daily for basic
          30000, // quota_monthly for basic
          '["read"]', // permissions
          null, // expires_at
          true // is_active
        ])
      );
    });

    test('should handle different tiers correctly', async () => {
      const tiers = ['free', 'basic', 'premium', 'enterprise'] as const;
      const expectedQuotas = {
        free: { daily: 100, monthly: 3000 },
        basic: { daily: 1000, monthly: 30000 },
        premium: { daily: 10000, monthly: 300000 },
        enterprise: { daily: 100000, monthly: 3000000 }
      };

      for (const tier of tiers) {
        const createData: CreateAPIKeyData = {
          name: `${tier} Key`,
          user_id: 'user-id',
          tier
        };

        mockPool.query = jest.fn().mockResolvedValue({
          rows: [{ id: 'key-id', ...createData }]
        });

        await service.createAPIKey(createData);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO api_keys'),
          expect.arrayContaining([
            expect.any(String),
            expect.any(String),
            'user-id',
            tier,
            expectedQuotas[tier].daily,
            expectedQuotas[tier].monthly,
            expect.any(String),
            expect.anything(),
            true
          ])
        );
      }
    });
  });

  describe('revokeAPIKey', () => {
    test('should revoke API key successfully', async () => {
      const keyId = 'key-id';
      const userId = 'user-id';

      mockPool.query = jest.fn().mockResolvedValue({
        rowCount: 1
      });

      const result = await service.revokeAPIKey(keyId, userId);
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [keyId, userId]
      );
    });

    test('should return false when key not found', async () => {
      const keyId = 'nonexistent-key';
      const userId = 'user-id';

      mockPool.query = jest.fn().mockResolvedValue({
        rowCount: 0
      });

      const result = await service.revokeAPIKey(keyId, userId);
      
      expect(result).toBe(false);
    });
  });

  describe('regenerateAPIKey', () => {
    test('should regenerate API key successfully', async () => {
      const keyId = 'key-id';
      const userId = 'user-id';
      const existingKey = {
        id: keyId,
        user_id: userId,
        name: 'Test Key'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [existingKey] }) // First call: get existing key
        .mockResolvedValueOnce({ rows: [] }); // Second call: update key

      const result = await service.regenerateAPIKey(keyId, userId);
      
      expect(result).toMatch(/^twinmcp_[a-zA-Z0-9]{32}$/);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    test('should throw error when key not found', async () => {
      const keyId = 'nonexistent-key';
      const userId = 'user-id';

      mockPool.query = jest.fn().mockResolvedValue({
        rows: []
      });

      await expect(service.regenerateAPIKey(keyId, userId)).rejects.toThrow('API key not found');
    });
  });

  describe('getAPIKeysByUser', () => {
    test('should return user API keys', async () => {
      const userId = 'user-id';
      const mockKeys = [
        { id: 'key1', user_id: userId },
        { id: 'key2', user_id: userId }
      ];

      mockPool.query = jest.fn().mockResolvedValue({
        rows: mockKeys
      });

      const result = await service.getAPIKeysByUser(userId);
      
      expect(result).toEqual(mockKeys);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, tier'),
        [userId]
      );
    });
  });

  describe('updateAPIKey', () => {
    test('should update API key successfully', async () => {
      const keyId = 'key-id';
      const userId = 'user-id';
      const updates = {
        name: 'Updated Name',
        tier: 'premium'
      };

      mockPool.query = jest.fn().mockResolvedValue({
        rowCount: 1
      });

      const result = await service.updateAPIKey(keyId, userId, updates);
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET'),
        expect.arrayContaining(['Updated Name', 'premium', keyId, userId])
      );
    });

    test('should return false when no fields to update', async () => {
      const keyId = 'key-id';
      const userId = 'user-id';
      const updates = { id: 'should-not-update' };

      const result = await service.updateAPIKey(keyId, userId, updates);
      
      expect(result).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
