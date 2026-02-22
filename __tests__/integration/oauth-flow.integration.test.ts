// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { OAuthService } from '../../src/services/oauth.service';
import { OAuthController } from '../../src/controllers/oauth.controller';
import { createAuthMiddleware } from '../../src/middleware/oauth.middleware';
import { OAuthConfig } from '../../src/types/oauth.types';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Mock des dépendances
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
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  },
  oAuthRefreshToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  }
} as any;

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

describe('OAuth Flow Integration', () => {
  let app: FastifyInstance;
  let oauthService: OAuthService;
  let oauthController: OAuthController;
  let config: OAuthConfig;

  beforeAll(async () => {
    // Configuration OAuth de test
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

    // Initialiser les services
    oauthService = new OAuthService(mockPrisma, mockRedis, config);
    oauthController = new OAuthController(oauthService);
    const authMiddleware = createAuthMiddleware(oauthService);

    // Créer l'application Fastify
    const fastify = require('fastify')();
    
    // Enregistrer les routes OAuth
    fastify.get('/oauth/authorize', oauthController.authorizationEndpoint.bind(oauthController));
    fastify.post('/oauth/consent', oauthController.consentEndpoint.bind(oauthController));
    fastify.post('/oauth/token', oauthController.tokenEndpoint.bind(oauthController));
    fastify.post('/oauth/revoke', oauthController.revokeEndpoint.bind(oauthController));
    fastify.post('/oauth/introspect', oauthController.introspectEndpoint.bind(oauthController));
    fastify.get('/oauth/userinfo', oauthController.userInfoEndpoint.bind(oauthController));

    // Route protégée pour tester
    fastify.get('/api/protected', {
      preHandler: authMiddleware.auth,
    }, async (request: any, reply: any) => {
        return { 
          message: 'Access granted',
          userId: request.oauthToken?.userId,
          scopes: request.oauthToken?.scopes
        };
      }
    );

    app = fastify;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Complete OAuth Authorization Code Flow', () => {
    // SHA-256 hash of 'test-secret'
    const testClientSecretHash = require('crypto').createHash('sha256').update('test-secret').digest('hex');

    const testClient = {
      clientId: 'test-client-id',
      clientSecretHash: testClientSecretHash,
      name: 'Test Client',
      redirectUris: ['https://example.com/callback'],
      allowedScopes: ['read', 'write'],
      grantTypes: ['authorization_code', 'refresh_token'],
      requirePkce: false,
      isActive: true
    };

    it('should complete full OAuth flow successfully', async () => {
      // 1. Mock client validation
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(testClient);

      // 2. Demander l'autorisation
      const authResponse = await app.inject({
        method: 'GET',
        url: '/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: testClient.redirectUris[0],
          scope: 'read write',
          state: 'test-state'
        },
        headers: {
          // Simuler une session utilisateur
          cookie: 'session=mock-session'
        }
      });

      // Comme nous n'avons pas de session, on devrait être redirigé vers login
      expect(authResponse.statusCode).toBe(302);

      // 3. Simuler le consentement (directement avec le token endpoint)
      // Mock pour la génération du code d'autorisation
      const mockAuthCode = {
        id: 'code-id',
        code: 'test-auth-code',
        clientId: testClient.clientId,
        userId: 'user-123',
        redirectUri: testClient.redirectUris[0],
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 600000)
      };

      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(mockAuthCode);
      mockPrisma.oAuthAuthorizationCode.delete.mockResolvedValue({});

      // Mock pour la génération des tokens
      const mockAccessToken = {
        id: 'access-token-id',
        tokenHash: 'hashed-access-token',
        clientId: testClient.clientId,
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockPrisma.oAuthAccessToken.create.mockResolvedValue(mockAccessToken);
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      // 4. Échanger le code contre des tokens
      const tokenResponse = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code: 'test-auth-code',
          redirect_uri: testClient.redirectUris[0],
          client_id: testClient.clientId,
          client_secret: 'test-secret'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(tokenResponse.statusCode).toBe(200);
      const tokens = JSON.parse(tokenResponse.payload);
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.scope).toBe('read write');

      // 5. Utiliser l'access token pour accéder à une ressource protégée
      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(mockAccessToken);
      mockRedis.get.mockResolvedValue(null);

      const apiResponse = await app.inject({
        method: 'GET',
        url: '/api/protected',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      });

      expect(apiResponse.statusCode).toBe(200);
      const protectedData = JSON.parse(apiResponse.payload);
      expect(protectedData.message).toBe('Access granted');
      expect(protectedData.userId).toBe('user-123');
    });

    it('should handle refresh token flow', async () => {
      // Mock client validation
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(testClient);

      // Mock refresh token
      const mockRefreshToken = {
        id: 'refresh-token-id',
        tokenHash: 'hashed-refresh-token',
        accessTokenId: 'access-token-id',
        clientId: testClient.clientId,
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 2592000000),
        isRevoked: false
      };

      mockPrisma.oAuthRefreshToken.findFirst.mockResolvedValue(mockRefreshToken);
      mockPrisma.oAuthRefreshToken.update.mockResolvedValue({ ...mockRefreshToken, isRevoked: true });

      // Mock new access token generation
      const mockNewAccessToken = {
        id: 'new-access-token-id',
        tokenHash: 'new-hashed-access-token',
        clientId: testClient.clientId,
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockPrisma.oAuthAccessToken.create.mockResolvedValue(mockNewAccessToken);
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: 'refresh-token-value',
          client_id: testClient.clientId,
          client_secret: 'test-secret'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(refreshResponse.statusCode).toBe(200);
      const newTokens = JSON.parse(refreshResponse.payload);
      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();
      expect(newTokens.token_type).toBe('Bearer');
    });

    it('should handle token revocation', async () => {
      // Mock client validation
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(testClient);
      mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });

      const revokeResponse = await app.inject({
        method: 'POST',
        url: '/oauth/revoke',
        payload: {
          token: 'access-token-to-revoke',
          token_type_hint: 'access_token',
          client_id: testClient.clientId,
          client_secret: 'test-secret'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(revokeResponse.statusCode).toBe(200);
    });

    it('should handle token introspection', async () => {
      // Mock client validation
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(testClient);

      // Mock token info
      const mockTokenInfo = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        clientId: testClient.clientId,
        userId: 'user-123',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        client: {
          name: 'Test Client'
        }
      };

      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(mockTokenInfo);

      const introspectResponse = await app.inject({
        method: 'POST',
        url: '/oauth/introspect',
        payload: {
          token: 'access-token-to-introspect',
          client_id: testClient.clientId,
          client_secret: 'test-secret'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(introspectResponse.statusCode).toBe(200);
      const introspection = JSON.parse(introspectResponse.payload);
      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe(testClient.clientId);
      expect(introspection.scope).toBe('read write');
      expect(introspection.sub).toBe('user-123');
    });

    it('should handle userinfo endpoint', async () => {
      // Mock token validation
      const mockTokenData = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        clientId: testClient.clientId,
        userId: 'user-123',
        scopes: ['openid', 'profile', 'email'],
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(mockTokenData);
      mockRedis.get.mockResolvedValue(null);

      const userInfoResponse = await app.inject({
        method: 'GET',
        url: '/oauth/userinfo',
        headers: {
          Authorization: 'Bearer access-token-value'
        }
      });

      expect(userInfoResponse.statusCode).toBe(200);
      const userInfo = JSON.parse(userInfoResponse.payload);
      expect(userInfo.sub).toBe('user-123');
      expect(userInfo.email).toBeDefined();
      expect(userInfo.name).toBeDefined();
    });

    it('should handle invalid authorization requests', async () => {
      // Client inexistant
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(null);

      const authResponse = await app.inject({
        method: 'GET',
        url: '/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: 'invalid-client',
          redirect_uri: 'https://example.com/callback',
          scope: 'read'
        }
      });

      expect(authResponse.statusCode).toBe(302);
      const location = authResponse.headers.location;
      expect(location).toContain('error=invalid_request');
    });

    it('should handle invalid token requests', async () => {
      // Client valide mais code invalide
      mockPrisma.oAuthClient.findFirst.mockResolvedValue(testClient);
      mockPrisma.oAuthAuthorizationCode.findFirst.mockResolvedValue(null);

      const tokenResponse = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: testClient.redirectUris[0],
          client_id: testClient.clientId,
          client_secret: 'test-secret'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(tokenResponse.statusCode).toBe(400);
      const error = JSON.parse(tokenResponse.payload);
      expect(error.error).toBe('invalid_grant');
    });

    it('should handle unauthorized access to protected resources', async () => {
      // Ensure validateAccessToken returns null for invalid tokens
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.oAuthAccessToken.findFirst.mockResolvedValue(null);

      const protectedResponse = await app.inject({
        method: 'GET',
        url: '/api/protected',
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });

      expect(protectedResponse.statusCode).toBe(401);
      const error = JSON.parse(protectedResponse.payload);
      expect(error.error).toBe('invalid_token');
    });
  });
});
