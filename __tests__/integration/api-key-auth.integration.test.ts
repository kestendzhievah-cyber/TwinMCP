// @ts-nocheck
import { NextRequest } from 'next/server';

// Mock Prisma
const mockPrisma = {
  apiKey: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
  usageLog: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
  pool: { query: jest.fn() },
}));

jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Must be set before importing route module (constant is read at module init)
process.env.ALLOW_INSECURE_DEV_AUTH = 'true';

import { GET, POST, DELETE } from '../../app/api/api-keys/route';

// Helper to build a fake JWT with a user_id claim
function fakeJwt(userId: string, email?: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ user_id: userId, email })).toString('base64');
  return `${header}.${payload}.sig`;
}

const TEST_USER_ID = 'user-test-123';
const TEST_USER = {
  id: TEST_USER_ID,
  email: 'test@example.com',
  oauthId: TEST_USER_ID,
  oauthProvider: 'firebase',
  clientId: 'client-1',
};

describe('API Key Authentication Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user exists
    mockPrisma.user.findFirst.mockResolvedValue(TEST_USER);
    // Default: free plan
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    // Default: no existing keys
    mockPrisma.apiKey.count.mockResolvedValue(0);
    mockPrisma.apiKey.findMany.mockResolvedValue([]);
    // Default: usage stats
    mockPrisma.usageLog.count.mockResolvedValue(0);
    mockPrisma.usageLog.findMany.mockResolvedValue([]);
  });

  describe('API Key Creation', () => {
    test('should create API key successfully', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        keyHash: 'hash',
        keyPrefix: 'twinmcp_free_abcdef',
        name: 'Test Integration Key',
        tier: 'free',
        quotaDaily: 200,
        quotaMonthly: 6000,
        permissions: ['read', 'write'],
        createdAt: new Date(),
      });

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${fakeJwt(TEST_USER_ID, 'test@example.com')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Integration Key' }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.key).toMatch(/^twinmcp_free_/);
      expect(body.data.name).toBe('Test Integration Key');
    });

    test('should reject API key creation without authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    test('should validate required fields for API key creation', async () => {
      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tier: 'basic' }), // Missing name
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('API Key Validation', () => {
    test('should authenticate with valid API key via x-api-key header', async () => {
      const rawKey = 'twinmcp_live_abc123';
      const keyHash = require('crypto').createHash('sha256').update(rawKey).digest('hex');

      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        keyHash,
        userId: TEST_USER_ID,
        isActive: true,
        revokedAt: null,
      });

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'GET',
        headers: { 'x-api-key': rawKey },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);
    });

    test('should reject access with invalid API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'GET',
        headers: { 'x-api-key': 'twinmcp_invalid_key' },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    test('should authenticate via Bearer JWT token', async () => {
      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'GET',
        headers: { 'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}` },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);
    });
  });

  describe('Quota Management', () => {
    test('should enforce key limit per plan', async () => {
      // Free plan allows 3 keys
      mockPrisma.apiKey.count.mockResolvedValue(3);

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Over Limit Key' }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('KEY_LIMIT_EXCEEDED');
    });

    test('should allow more keys for pro plan', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        subscriptions: [{ status: 'ACTIVE', plan: 'pro' }],
      });
      mockPrisma.apiKey.count.mockResolvedValue(3); // Under pro limit of 10
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-pro',
        keyHash: 'hash',
        keyPrefix: 'twinmcp_live_abc',
        name: 'Pro Key',
        tier: 'pro',
        quotaDaily: 10000,
        quotaMonthly: 300000,
        permissions: ['read', 'write'],
        createdAt: new Date(),
      });

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Pro Key' }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
    });
  });

  describe('API Key Management', () => {
    test('should list user API keys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          keyPrefix: 'twinmcp_free_abc',
          name: 'My Key',
          tier: 'free',
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'GET',
        headers: { 'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}` },
      });

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe('My Key');
    });

    test('should revoke API key', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({
        id: 'key-to-revoke',
        userId: TEST_USER_ID,
      });
      mockPrisma.apiKey.update.mockResolvedValue({});

      const req = new NextRequest('http://localhost:3000/api/api-keys?id=key-to-revoke', {
        method: 'DELETE',
        headers: { 'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}` },
      });

      const response = await DELETE(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('API key revoked successfully');
    });

    test('should reject revoking non-existent key', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/api-keys?id=nonexistent', {
        method: 'DELETE',
        headers: { 'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}` },
      });

      const response = await DELETE(req);
      expect(response.status).toBe(404);
    });

    test('should require key ID for revocation', async () => {
      const req = new NextRequest('http://localhost:3000/api/api-keys', {
        method: 'DELETE',
        headers: { 'authorization': `Bearer ${fakeJwt(TEST_USER_ID)}` },
      });

      const response = await DELETE(req);
      expect(response.status).toBe(400);
    });
  });
});
