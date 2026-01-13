import { OAuthService } from '../../src/services/oauth.service';
import { OAuthConfig } from '../../src/types/oauth.types';
// Mock Prisma et Redis (les imports sont nécessaires pour les mocks)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createClient } from 'redis';

// Mock Prisma
const mockPrisma = {
  oAuthClient: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  oAuthAuthorizationCode: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  oAuthAccessToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  },
  oAuthRefreshToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  }
} as any;

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedis)
}));

describe('OAuthService', () => {
  let service: OAuthService;
  let config: OAuthConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      authorizationServer: {
        issuer: 'https://api.twinmcp.com',
        authorizationEndpoint: '/oauth/authorize',
        tokenEndpoint: '/oauth/token',
        userInfoEndpoint: '/oauth/userinfo',
        revocationEndpoint: '/oauth/revoke'
      },
      clients: new Map(),
      supportedScopes: ['read', 'write', 'admin', 'openid', 'profile', 'email'],
      tokenConfig: {
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 2592000,
        idTokenLifetime: 3600
      }
    };

    service = new OAuthService(mockPrisma as any, mockRedis as any, config);
  });

  describe('validateClient', () => {
    it('should return client when valid credentials provided', async () => {
      const mockClient = {
        clientId: 'test-client',
        clientSecretHash: 'hashed-secret',
        redirectUris: ['https://example.com/callback'],
        allowedScopes: ['read', 'write'],
        grantTypes: ['authorization_code', 'refresh_token'],
        requirePkce: true
      };

      mockPrisma.oAuthClient.findFirst.mockResolvedValue(mockClient);

      const result = await service.validateClient('test-client', 'secret');

      expect(result).toBeTruthy();
      expect(result?.clientId).toBe('test-client');
      expect(mockPrisma.oAuthClient.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: 'test-client',
          isActive: true
        }
      });
    });

    it('should return null when client not found', async () => {
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(null);

      const result = await service.validateClient('invalid-client');

      expect(result).toBeNull();
    });

    it('should return null when client secret is invalid', async () => {
      const mockClient = {
        clientId: 'test-client',
        clientSecretHash: 'hashed-secret',
        redirectUris: ['https://example.com/callback'],
        allowedScopes: ['read', 'write'],
        grantTypes: ['authorization_code', 'refresh_token'],
        requirePkce: true
      };

      mockPrisma.oAuthClient.findFirst.mockResolvedValue(mockClient);

      const result = await service.validateClient('test-client', 'wrong-secret');

      expect(result).toBeNull();
    });
  });

  describe('generateAuthorizationCode', () => {
    it('should generate and store authorization code', async () => {
      const mockCode = {
        id: 'code-id',
        code: 'generated-code',
        clientId: 'test-client',
        userId: 'user-123',
        redirectUri: 'https://example.com/callback',
        scopes: ['read', 'write'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiresAt: expect.any(Date)
      };

      mockPrisma.oAuthAuthorizationCode.create.mockResolvedValue(mockCode);

      const result = await service.generateAuthorizationCode(
        'test-client',
        'user-123',
        'https://example.com/callback',
        ['read', 'write'],
        'challenge',
        'S256'
      );

      expect(result).toBe('generated-code');
      expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
        data: {
          code: expect.any(String),
          clientId: 'test-client',
          userId: 'user-123',
          redirectUri: 'https://example.com/callback',
          scopes: ['read', 'write'],
          codeChallenge: 'challenge',
          codeChallengeMethod: 'S256',
          expiresAt: expect.any(Date)
        }
      });
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should validate and return authorization code', async () => {
      const mockAuthCode = {
        id: 'code-id',
        code: 'test-code',
        clientId: 'test-client',
        userId: 'user-123',
        redirectUri: 'https://example.com/callback',
        scopes: ['read', 'write'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + 60000) // Future
      };

      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(mockAuthCode);
      mockPrisma.oAuthAuthorizationCode.delete.mockResolvedValue({});

      const result = await service.validateAuthorizationCode(
        'test-code',
        'test-client',
        'https://example.com/callback',
        'verifier'
      );

      expect(result).toBeTruthy();
      expect(result?.code).toBe('test-code');
      expect(mockPrisma.oAuthAuthorizationCode.delete).toHaveBeenCalledWith({
        where: { id: 'code-id' }
      });
    });

    it('should return null for expired code', async () => {
      // Simuler un code expiré en retournant null
      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(null);

      const result = await service.validateAuthorizationCode(
        'test-code',
        'test-client',
        'https://example.com/callback'
      );

      expect(result).toBeNull();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const mockAccessToken = {
        id: 'access-token-id',
        tokenHash: 'hashed-access-token',
        clientId: 'test-client',
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: expect.any(Date)
      };

      mockPrisma.oAuthAccessToken.create.mockResolvedValue(mockAccessToken);
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(
        'test-client',
        'user-123',
        ['read', 'write']
      );

      expect(result).toBeTruthy();
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toBe('read write');
    });

    it('should include id_token when openid scope is present', async () => {
      process.env['JWT_SECRET'] = 'test-secret';

      const mockAccessToken = {
        id: 'access-token-id',
        tokenHash: 'hashed-access-token',
        clientId: 'test-client',
        userId: 'user-123',
        scopes: ['openid', 'profile'],
        expiresAt: expect.any(Date)
      };

      mockPrisma.oAuthAccessToken.create.mockResolvedValue(mockAccessToken);
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(
        'test-client',
        'user-123',
        ['openid', 'profile']
      );

      expect(result?.id_token).toBeDefined();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate access token from cache', async () => {
      const mockTokenData = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        clientId: 'test-client',
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 60000)
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockTokenData));

      const result = await service.validateAccessToken('access-token');

      expect(result).toBeTruthy();
      expect(result?.userId).toBe('user-123');
      expect(mockRedis.get).toHaveBeenCalledWith('access_token:hashed-token');
    });

    it('should validate access token from database when not cached', async () => {
      const mockTokenData = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        clientId: 'test-client',
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 60000)
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(mockTokenData);

      const result = await service.validateAccessToken('access-token');

      expect(result).toBeTruthy();
      expect(result?.userId).toBe('user-123');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'access_token:hashed-token',
        300,
        JSON.stringify(mockTokenData)
      );
    });

    it('should return null for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(null);

      const result = await service.validateAccessToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke access token', async () => {
      mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeToken('access-token', 'access');

      expect(result).toBe(true);
      expect(mockPrisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
        data: { expiresAt: expect.any(Date) }
      });
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should revoke refresh token', async () => {
      mockPrisma.oAuthRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeToken('refresh-token', 'refresh');

      expect(result).toBe(true);
      expect(mockPrisma.oAuthRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
        data: { isRevoked: true }
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens', async () => {
      mockPrisma.oAuthAccessToken.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.oAuthRefreshToken.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.oAuthAuthorizationCode.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.cleanupExpiredTokens();

      expect(result.accessTokensDeleted).toBe(5);
      expect(result.refreshTokensDeleted).toBe(3);
      expect(result.authorizationCodesDeleted).toBe(2);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('PKCE verification', () => {
    it('should verify S256 PKCE challenge', async () => {
      const codeVerifier = 'test_verifier_123';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const codeChallengeMethod = 'S256';

      const mockCode = {
        id: 'code-id',
        code: 'test-code',
        clientId: 'test-client',
        userId: 'user-123',
        redirectUri: 'https://example.com/callback',
        scopes: ['read', 'write'],
        codeChallenge,
        codeChallengeMethod,
        expiresAt: new Date(Date.now() + 60000)
      };

      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(mockCode);
      mockPrisma.oAuthAuthorizationCode.delete.mockResolvedValue({});

      const result = await service.validateAuthorizationCode(
        'test-code',
        'test-client',
        'https://example.com/callback',
        codeVerifier
      );

      expect(result).toBeTruthy();
    });

    it('should verify plain PKCE challenge', async () => {
      const codeVerifier = 'plain_challenge';
      const codeChallenge = 'plain_challenge';
      const codeChallengeMethod = 'plain';

      const mockCode = {
        id: 'code-id',
        code: 'test-code',
        clientId: 'test-client',
        userId: 'user-123',
        redirectUri: 'https://example.com/callback',
        scopes: ['read', 'write'],
        codeChallenge,
        codeChallengeMethod,
        expiresAt: new Date(Date.now() + 60000)
      };

      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(mockCode);
      mockPrisma.oAuthAuthorizationCode.delete.mockResolvedValue({});

      const result = await service.validateAuthorizationCode(
        'test-code',
        'test-client',
        'https://example.com/callback',
        codeVerifier
      );

      expect(result).toBeTruthy();
    });
  });
});
