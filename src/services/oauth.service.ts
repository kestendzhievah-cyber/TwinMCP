import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { randomBytes, createHash } from 'crypto';
import { sign } from 'jsonwebtoken';
import { 
  OAuthConfig, 
  OAuthClient, 
  AuthorizationCode, 
  AccessToken, 
  OAuthTokenResponse,
  CleanupResult,
  TokenInfo,
  UserTokens
} from '../types/oauth.types';

export class OAuthService {
  private prisma: PrismaClient;
  private redis: ReturnType<typeof createClient>;
  private config: OAuthConfig;

  constructor(prisma: PrismaClient, redis: ReturnType<typeof createClient>, config: OAuthConfig) {
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient | null> {
    const client = await this.prisma.oAuthClient.findFirst({
      where: {
        clientId,
        isActive: true
      }
    });

    if (!client) {
      return null;
    }

    // Vérifier le client secret si fourni
    if (clientSecret) {
      const secretHash = this.hashClientSecret(clientSecret);
      if (client.clientSecretHash !== secretHash) {
        return null;
      }
    }

    return {
      clientId: client.clientId,
      clientSecret: client.clientSecretHash,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      grantTypes: client.grantTypes as ('authorization_code' | 'client_credentials' | 'refresh_token')[],
      requirePKCE: client.requirePkce
    };
  }

  async generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scopes: string[],
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): Promise<string> {
    const code = this.generateRandomString(32);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        clientId,
        userId,
        redirectUri,
        scopes,
        codeChallenge,
        codeChallengeMethod,
        expiresAt
      }
    });

    return code;
  }

  async validateAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<AuthorizationCode | null> {
    const authCode = await this.prisma.oAuthAuthorizationCode.findFirst({
      where: {
        code,
        clientId,
        redirectUri,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!authCode) {
      return null;
    }

    // Vérifier PKCE si requis
    if (authCode.codeChallenge && codeVerifier) {
      const isValid = this.verifyPKCE(
        authCode.codeChallenge,
        authCode.codeChallengeMethod,
        codeVerifier
      );

      if (!isValid) {
        return null;
      }
    }

    // Marquer le code comme utilisé
    await this.prisma.oAuthAuthorizationCode.delete({
      where: { id: authCode.id }
    });

    return {
      id: authCode.id,
      code: authCode.code,
      clientId: authCode.clientId,
      userId: authCode.userId,
      redirectUri: authCode.redirectUri,
      scopes: authCode.scopes,
      codeChallenge: authCode.codeChallenge,
      codeChallengeMethod: authCode.codeChallengeMethod,
      expiresAt: authCode.expiresAt
    };
  }

  async generateTokens(
    clientId: string,
    userId: string,
    scopes: string[]
  ): Promise<OAuthTokenResponse> {
    const accessToken = this.generateRandomString(64);
    const refreshToken = this.generateRandomString(64);
    const now = new Date();

    const accessTokenExpiresAt = new Date(now.getTime() + this.config.tokenConfig.accessTokenLifetime * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + this.config.tokenConfig.refreshTokenLifetime * 1000);

    // Stocker l'access token
    const accessTokenRecord = await this.prisma.oAuthAccessToken.create({
      data: {
        tokenHash: this.hashToken(accessToken),
        clientId,
        userId,
        scopes,
        expiresAt: accessTokenExpiresAt
      }
    });

    // Stocker le refresh token
    await this.prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        accessTokenId: accessTokenRecord.id,
        clientId,
        userId,
        scopes,
        expiresAt: refreshTokenExpiresAt
      }
    });

    // Générer l'ID token si scope openid
    let idToken: string | undefined;
    if (scopes.includes('openid')) {
      idToken = await this.generateIdToken(userId, clientId, accessTokenExpiresAt);
    }

    const tokenResponse: OAuthTokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.tokenConfig.accessTokenLifetime,
      refresh_token: refreshToken,
      scope: scopes.join(' ')
    };

    if (idToken) {
      tokenResponse.id_token = idToken;
    }

    return tokenResponse;
  }

  async refreshAccessToken(refreshToken: string, clientId: string): Promise<OAuthTokenResponse | null> {
    const tokenData = await this.prisma.oAuthRefreshToken.findFirst({
      where: {
        tokenHash: this.hashToken(refreshToken),
        clientId,
        isRevoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!tokenData) {
      return null;
    }

    // Révoquer l'ancien refresh token
    await this.prisma.oAuthRefreshToken.update({
      where: { id: tokenData.id },
      data: { isRevoked: true }
    });

    // Générer de nouveaux tokens
    return this.generateTokens(clientId, tokenData.userId, tokenData.scopes);
  }

  async validateAccessToken(token: string): Promise<AccessToken | null> {
    // Vérifier le cache Redis
    const cacheKey = `access_token:${this.hashToken(token)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Vérifier en base de données
    const tokenData = await this.prisma.oAuthAccessToken.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!tokenData) {
      return null;
    }

    const result = {
      id: tokenData.id,
      tokenHash: tokenData.tokenHash,
      clientId: tokenData.clientId,
      userId: tokenData.userId,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expiresAt
    };

    // Mettre en cache pour 5 minutes
    if (this.redis && this.redis['setex']) {
      await this.redis['setex'](cacheKey, 300, JSON.stringify(result));
    }

    return result;
  }

  async revokeToken(token: string, tokenType: 'access' | 'refresh'): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    if (tokenType === 'access') {
      const result = await this.prisma.oAuthAccessToken.updateMany({
        where: { tokenHash },
        data: { expiresAt: new Date() }
      });
      
      // Supprimer du cache Redis
      await this.redis.del(`access_token:${tokenHash}`);
      
      return result.count > 0;
    } else {
      const result = await this.prisma.oAuthRefreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true }
      });
      
      return result.count > 0;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    // Révoquer tous les access tokens
    await this.prisma.oAuthAccessToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date() }
    });

    // Révoquer tous les refresh tokens
    const result = await this.prisma.oAuthRefreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true }
    });

    // Nettoyer le cache Redis
    const pattern = `access_token:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await this.redis.del(key);
      }
    }

    return result.count;
  }

  async cleanupExpiredTokens(): Promise<CleanupResult> {
    const now = new Date();

    // Nettoyer les access tokens expirés
    const expiredAccessResult = await this.prisma.oAuthAccessToken.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    // Nettoyer les refresh tokens expirés
    const expiredRefreshResult = await this.prisma.oAuthRefreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    // Nettoyer les codes d'autorisation expirés
    const expiredCodesResult = await this.prisma.oAuthAuthorizationCode.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    return {
      accessTokensDeleted: expiredAccessResult.count,
      refreshTokensDeleted: expiredRefreshResult.count,
      authorizationCodesDeleted: expiredCodesResult.count,
      timestamp: now
    };
  }

  async getTokenInfo(token: string): Promise<TokenInfo | null> {
    const tokenHash = this.hashToken(token);

    // Vérifier si c'est un access token
    const accessResult = await this.prisma.oAuthAccessToken.findFirst({
      where: { tokenHash },
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    });

    if (accessResult) {
      return {
        type: 'access',
        clientId: accessResult.clientId,
        clientName: accessResult.client.name,
        userId: accessResult.userId,
        scopes: accessResult.scopes,
        expiresAt: accessResult.expiresAt,
        createdAt: accessResult.createdAt
      };
    }

    // Vérifier si c'est un refresh token
    const refreshResult = await this.prisma.oAuthRefreshToken.findFirst({
      where: { 
        tokenHash,
        isRevoked: false
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    });

    if (refreshResult) {
      return {
        type: 'refresh',
        clientId: refreshResult.clientId,
        clientName: refreshResult.client.name,
        userId: refreshResult.userId,
        scopes: refreshResult.scopes,
        expiresAt: refreshResult.expiresAt,
        createdAt: refreshResult.createdAt,
        isRevoked: refreshResult.isRevoked
      };
    }

    return null;
  }

  async getUserActiveTokens(userId: string): Promise<UserTokens> {
    const accessTokens = await this.prisma.oAuthAccessToken.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const refreshTokens = await this.prisma.oAuthRefreshToken.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        },
        isRevoked: false
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      accessTokens,
      refreshTokens
    };
  }

  private async generateIdToken(userId: string, clientId: string, expiresAt: Date): Promise<string> {
    const payload = {
      iss: this.config.authorizationServer.issuer,
      sub: userId,
      aud: clientId,
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      auth_time: Math.floor(Date.now() / 1000)
    };

    return sign(payload, process.env['JWT_SECRET']!, { algorithm: 'HS256' });
  }

  private verifyPKCE(codeChallenge: string, codeChallengeMethod: string | null, codeVerifier: string): boolean {
    let hash: string;

    if (codeChallengeMethod === 'S256') {
      hash = createHash('sha256').update(codeVerifier).digest('base64url');
    } else {
      // Plain method (non recommandé)
      hash = codeVerifier;
    }

    return hash === codeChallenge;
  }

  private generateRandomString(length: number): string {
    return randomBytes(length).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashClientSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
