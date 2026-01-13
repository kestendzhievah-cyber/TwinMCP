# Story 3.3: Flux OAuth 2.0

## Résumé

**Epic**: 3 - API Gateway et Authentification  
**Story**: 3.3 - Flux OAuth 2.0  
**Description**: Implémentation complète du flow OAuth 2.0 pour les IDE  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Implémenter un flux OAuth 2.0 complet et sécurisé qui permet aux IDE et autres clients de s'authentifier de manière standardisée pour accéder à l'API TwinMCP.

---

## Prérequis

- Story 3.1: API Gateway de base complétée
- Story 3.2: Service d'authentification API Keys complété
- Base de données PostgreSQL configurée
- Redis configuré pour sessions

---

## Spécifications Techniques

### 1. Flow OAuth 2.0 Authorization Code

```typescript
interface OAuthConfig {
  authorizationServer: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
    revocationEndpoint: string;
  };
  clients: Map<string, OAuthClient>;
  supportedScopes: string[];
  tokenConfig: {
    accessTokenLifetime: number;    // 1 heure
    refreshTokenLifetime: number;   // 30 jours
    idTokenLifetime: number;        // 1 heure
  };
}

interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: ('authorization_code' | 'client_credentials' | 'refresh_token')[];
  requirePKCE: boolean;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}
```

### 2. Schéma de base de données

```sql
-- Clients OAuth
CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(64) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  allowed_scopes TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL,
  require_pkce BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Authorization codes
CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) UNIQUE NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  scopes TEXT[] NOT NULL,
  code_challenge VARCHAR(128),
  code_challenge_method VARCHAR(8),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Access tokens
CREATE TABLE oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  access_token_id UUID REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Tâches Détaillées

### Étape 1: Configurer Passport.js avec stratégies OAuth

**Objectif**: Mettre en place l'infrastructure OAuth avec Passport.js

**Actions**:
1. Installer et configurer Passport.js
2. Implémenter la stratégie OAuth 2.0
3. Ajouter la validation PKCE
4. Configurer les sessions Redis

**Implémentation**:
```typescript
// src/services/oauth.service.ts
import { Pool } from 'pg';
import { Redis } from 'redis';
import { randomBytes, createHash } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { OAuthConfig, OAuthClient, AuthorizationCode, AccessToken, RefreshToken } from '../types/oauth.types';

export class OAuthService {
  private db: Pool;
  private redis: Redis;
  private config: OAuthConfig;

  constructor(db: Pool, redis: Redis, config: OAuthConfig) {
    this.db = db;
    this.redis = redis;
    this.config = config;
  }

  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient | null> {
    const result = await this.db.query(
      `SELECT * FROM oauth_clients 
       WHERE client_id = $1 AND is_active = true`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const client = result.rows[0];

    // Vérifier le client secret si fourni
    if (clientSecret) {
      const secretHash = this.hashClientSecret(clientSecret);
      if (client.client_secret_hash !== secretHash) {
        return null;
      }
    }

    return {
      clientId: client.client_id,
      clientSecret: client.client_secret_hash,
      redirectUris: client.redirect_uris,
      allowedScopes: client.allowed_scopes,
      grantTypes: client.grant_types,
      requirePKCE: client.require_pkce
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

    await this.db.query(
      `INSERT INTO oauth_authorization_codes 
       (code, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [code, clientId, userId, redirectUri, scopes, codeChallenge, codeChallengeMethod, expiresAt]
    );

    return code;
  }

  async validateAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<AuthorizationCode | null> {
    const result = await this.db.query(
      `SELECT * FROM oauth_authorization_codes 
       WHERE code = $1 AND client_id = $2 AND redirect_uri = $3 AND expires_at > NOW()`,
      [code, clientId, redirectUri]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const authCode = result.rows[0];

    // Vérifier PKCE si requis
    if (authCode.code_challenge && codeVerifier) {
      const isValid = this.verifyPKCE(
        authCode.code_challenge,
        authCode.code_challenge_method,
        codeVerifier
      );

      if (!isValid) {
        return null;
      }
    }

    // Marquer le code comme utilisé
    await this.db.query(
      'DELETE FROM oauth_authorization_codes WHERE code = $1',
      [code]
    );

    return {
      id: authCode.id,
      code: authCode.code,
      clientId: authCode.client_id,
      userId: authCode.user_id,
      redirectUri: authCode.redirect_uri,
      scopes: authCode.scopes,
      codeChallenge: authCode.code_challenge,
      codeChallengeMethod: authCode.code_challenge_method,
      expiresAt: authCode.expires_at
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
    const accessTokenResult = await this.db.query(
      `INSERT INTO oauth_access_tokens 
       (token_hash, client_id, user_id, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [this.hashToken(accessToken), clientId, userId, scopes, accessTokenExpiresAt]
    );

    const accessTokenId = accessTokenResult.rows[0].id;

    // Stocker le refresh token
    await this.db.query(
      `INSERT INTO oauth_refresh_tokens 
       (token_hash, access_token_id, client_id, user_id, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [this.hashToken(refreshToken), accessTokenId, clientId, userId, scopes, refreshTokenExpiresAt]
    );

    // Générer l'ID token si scope openid
    let idToken;
    if (scopes.includes('openid')) {
      idToken = await this.generateIdToken(userId, clientId, accessTokenExpiresAt);
    }

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.tokenConfig.accessTokenLifetime,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
      id_token: idToken
    };
  }

  async refreshAccessToken(refreshToken: string, clientId: string): Promise<OAuthTokenResponse | null> {
    const result = await this.db.query(
      `SELECT rt.*, at.scopes as token_scopes
       FROM oauth_refresh_tokens rt
       JOIN oauth_access_tokens at ON rt.access_token_id = at.id
       WHERE rt.token_hash = $1 AND rt.client_id = $2 AND rt.is_revoked = false AND rt.expires_at > NOW()`,
      [this.hashToken(refreshToken), clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tokenData = result.rows[0];

    // Révoquer l'ancien refresh token
    await this.db.query(
      'UPDATE oauth_refresh_tokens SET is_revoked = true WHERE id = $1',
      [tokenData.id]
    );

    // Générer de nouveaux tokens
    return this.generateTokens(clientId, tokenData.user_id, tokenData.token_scopes);
  }

  async validateAccessToken(token: string): Promise<AccessToken | null> {
    // Vérifier le cache Redis
    const cacheKey = `access_token:${this.hashToken(token)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Vérifier en base de données
    const result = await this.db.query(
      `SELECT * FROM oauth_access_tokens 
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [this.hashToken(token)]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tokenData = result.rows[0];

    // Mettre en cache pour 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(tokenData));

    return {
      id: tokenData.id,
      tokenHash: tokenData.token_hash,
      clientId: tokenData.client_id,
      userId: tokenData.user_id,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expires_at
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

    return sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' });
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
```

**Validation**:
- Tests de validation de client
- Tests de génération de codes d'autorisation
- Tests de PKCE

---

### Étape 2: Implémenter l'endpoint d'autorisation

**Objectif**: Créer l'endpoint d'autorisation OAuth 2.0

**Actions**:
1. Créer la page de consentement
2. Implémenter la validation des paramètres
3. Ajouter la gestion des scopes
4. Gérer les erreurs d'autorisation

**Implémentation**:
```typescript
// src/controllers/oauth.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuthService } from '../services/oauth.service';
import { UserService } from '../services/user.service';

export class OAuthController {
  constructor(
    private oauthService: OAuthService,
    private userService: UserService
  ) {}

  async authorizationEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method
      } = request.query as any;

      // Valider les paramètres obligatoires
      if (!response_type || response_type !== 'code') {
        throw new Error('response_type=code requis');
      }

      if (!client_id || !redirect_uri) {
        throw new Error('client_id et redirect_uri requis');
      }

      // Valider le client
      const client = await this.oauthService.validateClient(client_id);
      if (!client) {
        throw new Error('Client invalide');
      }

      // Valider l'URI de redirection
      if (!client.redirectUris.includes(redirect_uri)) {
        throw new Error('URI de redirection non autorisée');
      }

      // Valider les scopes
      const requestedScopes = scope ? scope.split(' ') : [];
      const validScopes = this.validateScopes(requestedScopes, client.allowedScopes);

      // Vérifier PKCE si requis
      if (client.requirePKCE && !code_challenge) {
        throw new Error('PKCE requis pour ce client');
      }

      // Vérifier si l'utilisateur est authentifié
      if (!request.session?.userId) {
        // Rediriger vers la page de login avec retour
        const loginUrl = `/login?redirect=${encodeURIComponent(request.url)}`;
        return reply.redirect(loginUrl);
      }

      // Afficher la page de consentement
      return reply.view('oauth-consent', {
        client: {
          name: client.clientId,
          clientId: client.clientId
        },
        scopes: validScopes,
        redirectUri: redirect_uri,
        state: state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        user: await this.userService.getUserById(request.session.userId)
      });

    } catch (error) {
      // Rediriger avec erreur
      const errorParams = new URLSearchParams({
        error: 'invalid_request',
        error_description: error.message
      });

      if (request.query.state) {
        errorParams.append('state', request.query.state as string);
      }

      return reply.redirect(`${request.query.redirect_uri}?${errorParams.toString()}`);
    }
  }

  async consentEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        approve
      } = request.body as any;

      if (approve !== 'yes') {
        // Utilisateur refuse le consentement
        const errorParams = new URLSearchParams({
          error: 'access_denied',
          error_description: 'Utilisateur a refusé l\'accès'
        });

        if (state) {
          errorParams.append('state', state);
        }

        return reply.redirect(`${redirect_uri}?${errorParams.toString()}`);
      }

      // Générer le code d'autorisation
      const authCode = await this.oauthService.generateAuthorizationCode(
        client_id,
        request.session!.userId,
        redirect_uri,
        scope ? scope.split(' ') : [],
        code_challenge,
        code_challenge_method
      );

      // Rediriger avec le code d'autorisation
      const successParams = new URLSearchParams({
        code: authCode
      });

      if (state) {
        successParams.append('state', state);
      }

      return reply.redirect(`${redirect_uri}?${successParams.toString()}`);

    } catch (error) {
      request.log.error('OAuth consent error', error);
      
      const errorParams = new URLSearchParams({
        error: 'server_error',
        error_description: 'Erreur interne du serveur'
      });

      if (request.body.state) {
        errorParams.append('state', request.body.state);
      }

      return reply.redirect(`${request.body.redirect_uri}?${errorParams.toString()}`);
    }
  }

  async tokenEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        grant_type,
        code,
        redirect_uri,
        client_id,
        client_secret,
        code_verifier,
        refresh_token
      } = request.body as any;

      let tokenResponse: OAuthTokenResponse | null = null;

      if (grant_type === 'authorization_code') {
        // Flow authorization code
        if (!code || !redirect_uri || !client_id) {
          throw new Error('Paramètres manquants pour authorization_code');
        }

        // Valider le client
        const client = await this.oauthService.validateClient(client_id, client_secret);
        if (!client) {
          throw new Error('Client invalide');
        }

        // Valider le code d'autorisation
        const authCode = await this.oauthService.validateAuthorizationCode(
          code,
          client_id,
          redirect_uri,
          code_verifier
        );

        if (!authCode) {
          throw new Error('Code d\'autorisation invalide');
        }

        // Générer les tokens
        tokenResponse = await this.oauthService.generateTokens(
          client_id,
          authCode.userId,
          authCode.scopes
        );

      } else if (grant_type === 'refresh_token') {
        // Flow refresh token
        if (!refresh_token || !client_id) {
          throw new Error('Paramètres manquants pour refresh_token');
        }

        // Valider le client
        const client = await this.oauthService.validateClient(client_id, client_secret);
        if (!client) {
          throw new Error('Client invalide');
        }

        // Rafraîchir les tokens
        tokenResponse = await this.oauthService.refreshAccessToken(refresh_token, client_id);

        if (!tokenResponse) {
          throw new Error('Refresh token invalide');
        }

      } else {
        throw new Error('Grant type non supporté');
      }

      reply.send(tokenResponse);

    } catch (error) {
      request.log.error('OAuth token error', error);
      
      reply.status(400).send({
        error: 'invalid_grant',
        error_description: error.message
      });
    }
  }

  private validateScopes(requested: string[], allowed: string[]): string[] {
    return requested.filter(scope => allowed.includes(scope));
  }
}
```

**Validation**:
- Tests de l'endpoint d'autorisation
- Tests de consentement utilisateur
- Tests de gestion d'erreurs

---

### Étape 3: Créer l'échange de code contre token

**Objectif**: Implémenter l'endpoint token pour l'échange de code

**Actions**:
1. Créer l'endpoint POST /oauth/token
2. Implémenter la validation grant_type
3. Ajouter la gestion des refresh tokens
4. Gérer les erreurs OAuth

**Implémentation**:
```typescript
// src/middleware/oauth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuthService } from '../services/oauth.service';

export class OAuthMiddleware {
  constructor(private oauthService: OAuthService) {}

  authenticate() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Token d\'accès manquant'
        });
        return;
      }

      const token = authHeader.substring(7);
      const tokenData = await this.oauthService.validateAccessToken(token);

      if (!tokenData) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Token d\'accès invalide ou expiré'
        });
        return;
      }

      // Ajouter les informations du token au contexte
      request.oauthToken = tokenData;
    };
  }

  requireScope(requiredScope: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      if (!request.oauthToken.scopes.includes(requiredScope)) {
        reply.status(403).send({
          error: 'insufficient_scope',
          error_description: `Scope '${requiredScope}' requis`
        });
        return;
      }
    };
  }
}

// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    oauthToken?: {
      id: string;
      clientId: string;
      userId: string;
      scopes: string[];
      expiresAt: Date;
    };
  }
}
```

**Validation**:
- Tests d'authentification Bearer
- Tests de validation de scopes
- Tests de gestion d'erreurs

---

### Étape 4: Gérer les refresh tokens et expiration

**Objectif**: Implémenter la gestion complète du cycle de vie des tokens

**Actions**:
1. Créer le service de gestion des tokens
2. Implémenter la révocation automatique
3. Ajouter le cleanup des tokens expirés
4. Optimiser les performances

**Implémentation**:
```typescript
// src/services/token-management.service.ts
import { Pool } from 'pg';
import { Redis } from 'redis';
import { OAuthService } from './oauth.service';

export class TokenManagementService {
  private db: Pool;
  private redis: Redis;
  private oauthService: OAuthService;

  constructor(db: Pool, redis: Redis, oauthService: OAuthService) {
    this.db = db;
    this.redis = redis;
    this.oauthService = oauthService;
  }

  async revokeToken(token: string, tokenType: 'access' | 'refresh'): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    if (tokenType === 'access') {
      const result = await this.db.query(
        'UPDATE oauth_access_tokens SET expires_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
      
      // Supprimer du cache Redis
      await this.redis.del(`access_token:${tokenHash}`);
      
      return result.rowCount > 0;
    } else {
      const result = await this.db.query(
        'UPDATE oauth_refresh_tokens SET is_revoked = true WHERE token_hash = $1',
        [tokenHash]
      );
      
      return result.rowCount > 0;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    // Révoquer tous les access tokens
    await this.db.query(
      'UPDATE oauth_access_tokens SET expires_at = NOW() WHERE user_id = $1',
      [userId]
    );

    // Révoquer tous les refresh tokens
    const result = await this.db.query(
      'UPDATE oauth_refresh_tokens SET is_revoked = true WHERE user_id = $1',
      [userId]
    );

    // Nettoyer le cache Redis
    const pattern = `access_token:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    return result.rowCount;
  }

  async cleanupExpiredTokens(): Promise<CleanupResult> {
    const now = new Date();

    // Nettoyer les access tokens expirés
    const expiredAccessResult = await this.db.query(
      'DELETE FROM oauth_access_tokens WHERE expires_at < $1',
      [now]
    );

    // Nettoyer les refresh tokens expirés
    const expiredRefreshResult = await this.db.query(
      'DELETE FROM oauth_refresh_tokens WHERE expires_at < $1',
      [now]
    );

    // Nettoyer les codes d'autorisation expirés
    const expiredCodesResult = await this.db.query(
      'DELETE FROM oauth_authorization_codes WHERE expires_at < $1',
      [now]
    );

    return {
      accessTokensDeleted: expiredAccessResult.rowCount,
      refreshTokensDeleted: expiredRefreshResult.rowCount,
      authorizationCodesDeleted: expiredCodesResult.rowCount,
      timestamp: now
    };
  }

  async getTokenInfo(token: string): Promise<TokenInfo | null> {
    const tokenHash = this.hashToken(token);

    // Vérifier si c'est un access token
    const accessResult = await this.db.query(
      `SELECT at.*, c.name as client_name
       FROM oauth_access_tokens at
       JOIN oauth_clients c ON at.client_id = c.client_id
       WHERE at.token_hash = $1`,
      [tokenHash]
    );

    if (accessResult.rows.length > 0) {
      const tokenData = accessResult.rows[0];
      return {
        type: 'access',
        clientId: tokenData.client_id,
        clientName: tokenData.client_name,
        userId: tokenData.user_id,
        scopes: tokenData.scopes,
        expiresAt: tokenData.expires_at,
        createdAt: tokenData.created_at
      };
    }

    // Vérifier si c'est un refresh token
    const refreshResult = await this.db.query(
      `SELECT rt.*, c.name as client_name
       FROM oauth_refresh_tokens rt
       JOIN oauth_clients c ON rt.client_id = c.client_id
       WHERE rt.token_hash = $1 AND rt.is_revoked = false`,
      [tokenHash]
    );

    if (refreshResult.rows.length > 0) {
      const tokenData = refreshResult.rows[0];
      return {
        type: 'refresh',
        clientId: tokenData.client_id,
        clientName: tokenData.client_name,
        userId: tokenData.user_id,
        scopes: tokenData.scopes,
        expiresAt: tokenData.expires_at,
        createdAt: tokenData.created_at,
        isRevoked: tokenData.is_revoked
      };
    }

    return null;
  }

  async getUserActiveTokens(userId: string): Promise<UserTokens> {
    const accessTokensResult = await this.db.query(
      `SELECT at.*, c.name as client_name
       FROM oauth_access_tokens at
       JOIN oauth_clients c ON at.client_id = c.client_id
       WHERE at.user_id = $1 AND at.expires_at > NOW()
       ORDER BY at.created_at DESC`,
      [userId]
    );

    const refreshTokensResult = await this.db.query(
      `SELECT rt.*, c.name as client_name
       FROM oauth_refresh_tokens rt
       JOIN oauth_clients c ON rt.client_id = c.client_id
       WHERE rt.user_id = $1 AND rt.expires_at > NOW() AND rt.is_revoked = false
       ORDER BY rt.created_at DESC`,
      [userId]
    );

    return {
      accessTokens: accessTokensResult.rows,
      refreshTokens: refreshTokensResult.rows
    };
  }

  private hashToken(token: string): string {
    return require('crypto').createHash('sha256').update(token).digest('hex');
  }
}

interface CleanupResult {
  accessTokensDeleted: number;
  refreshTokensDeleted: number;
  authorizationCodesDeleted: number;
  timestamp: Date;
}

interface TokenInfo {
  type: 'access' | 'refresh';
  clientId: string;
  clientName: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
  isRevoked?: boolean;
}

interface UserTokens {
  accessTokens: any[];
  refreshTokens: any[];
}
```

**Validation**:
- Tests de révocation de tokens
- Tests de cleanup automatique
- Tests de gestion du cycle de vie

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── services/
│   ├── oauth.service.ts
│   └── token-management.service.ts
├── controllers/
│   └── oauth.controller.ts
├── middleware/
│   └── oauth.middleware.ts
├── types/
│   └── oauth.types.ts
├── views/
│   └── oauth-consent.hbs
└── utils/
    └── crypto.utils.ts
```

### Configuration

```typescript
// config/oauth.config.ts
export const oauthConfig: OAuthConfig = {
  authorizationServer: {
    issuer: process.env.OAUTH_ISSUER || 'https://api.twinmcp.com',
    authorizationEndpoint: '/oauth/authorize',
    tokenEndpoint: '/oauth/token',
    userInfoEndpoint: '/oauth/userinfo',
    revocationEndpoint: '/oauth/revoke'
  },
  clients: new Map(),
  supportedScopes: ['read', 'write', 'admin', 'openid', 'profile', 'email'],
  tokenConfig: {
    accessTokenLifetime: 3600,    // 1 heure
    refreshTokenLifetime: 2592000, // 30 jours
    idTokenLifetime: 3600         // 1 heure
  }
};
```

---

## Tests

### Tests unitaires

```typescript
// __tests__/services/oauth.service.test.ts
describe('OAuthService', () => {
  let service: OAuthService;
  let mockDB: Pool;
  let mockRedis: Redis;

  beforeEach(() => {
    mockDB = createMockDatabase();
    mockRedis = createMockRedis();
    service = new OAuthService(mockDB, mockRedis, oauthConfig);
  });

  test('should validate client correctly', async () => {
    const result = await service.validateClient('test-client', 'test-secret');
    expect(result).toBeTruthy();
  });

  test('should generate authorization code', async () => {
    const code = await service.generateAuthorizationCode(
      'test-client',
      'user-123',
      'https://example.com/callback',
      ['read', 'write']
    );
    
    expect(code).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should validate PKCE challenge', async () => {
    const codeVerifier = 'test_verifier_123';
    const codeChallenge = service.generateCodeChallenge(codeVerifier, 'S256');
    
    const isValid = service.verifyPKCE(codeChallenge, 'S256', codeVerifier);
    expect(isValid).toBe(true);
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/oauth-flow.integration.test.ts
describe('OAuth Flow Integration', () => {
  let app: FastifyInstance;
  let testClient: OAuthClient;

  beforeAll(async () => {
    app = await createTestApp();
    testClient = await createTestOAuthClient();
  });

  test('should complete full OAuth flow', async () => {
    // 1. Demander l'autorisation
    const authResponse = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: {
        response_type: 'code',
        client_id: testClient.clientId,
        redirect_uri: testClient.redirectUris[0],
        scope: 'read write',
        state: 'test-state'
      }
    });

    expect(authResponse.statusCode).toBe(200);

    // 2. Simuler le consentement
    const consentResponse = await app.inject({
      method: 'POST',
      url: '/oauth/consent',
      payload: {
        client_id: testClient.clientId,
        redirect_uri: testClient.redirectUris[0],
        scope: 'read write',
        state: 'test-state',
        approve: 'yes'
      }
    });

    expect(consentResponse.statusCode).toBe(302);
    const location = consentResponse.headers.location;
    const authCode = new URL(location).searchParams.get('code');

    // 3. Échanger le code contre des tokens
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: testClient.redirectUris[0],
        client_id: testClient.clientId,
        client_secret: testClient.clientSecret
      }
    });

    expect(tokenResponse.statusCode).toBe(200);
    const tokens = tokenResponse.json();
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
    expect(tokens.token_type).toBe('Bearer');

    // 4. Utiliser l'access token
    const apiResponse = await app.inject({
      method: 'GET',
      url: '/api/user',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    expect(apiResponse.statusCode).toBe(200);
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de validation**: < 20ms (cache), < 100ms (DB)
- **Cache hit rate**: > 85%
- **Tokens actifs**: 10000+
- **Memory usage**: < 200MB

### Optimisations

1. **Redis cache** pour les access tokens
2. **Indexation** optimisée des tables
3. **Async cleanup** des tokens expirés
4. **Connection pooling** PostgreSQL

---

## Monitoring et Logging

### Logs structurés

```typescript
logger.info('OAuth token issued', {
  client_id: tokenData.clientId,
  user_id: tokenData.userId,
  scopes: tokenData.scopes,
  token_type: 'access_token',
  expires_in: tokenConfig.accessTokenLifetime
});
```

### Métriques

```typescript
export const OAuthMetrics = {
  authorizationRequests: new Counter('oauth_authorization_requests_total'),
  tokenGrants: new Counter('oauth_token_grants_total'),
  tokenRefreshes: new Counter('oauth_token_refreshes_total'),
  tokenValidations: new Counter('oauth_token_validations_total'),
  activeTokens: new Gauge('oauth_active_tokens_count')
};
```

---

## Sécurité

### Mesures de sécurité

1. **PKCE obligatoire** pour les clients publics
2. **Tokens JWT** signés avec secret fort
3. **HTTPS obligatoire** pour tous les endpoints
4. **Rate limiting** par client
5. **Audit trail** complet

### Best practices

- Utiliser des secrets forts et uniques
- Implémenter la rotation des secrets
- Surveiller les activités suspectes
- Révoquer les tokens compromis immédiatement

---

## Livrables

1. **Service OAuth 2.0** complet et sécurisé
2. **Endpoints d'autorisation** et de token
3. **Middleware d'authentification** robuste
4. **Gestion des tokens** complète
5. **Interface de consentement** utilisateur
6. **Documentation** OAuth détaillée
7. **Tests** unitaires et d'intégration

---

## Critères d'Achèvement

✅ Le flow OAuth 2.0 est conforme à la spécification  
✅ PKCE est implémenté et sécurisé  
✅ Les tokens sont générés et validés correctement  
✅ La révocation fonctionne immédiatement  
✅ Les performances respectent les cibles  
✅ La sécurité est robuste  
✅ Les logs et métriques sont complets  
✅ Les tests passent avec > 90% de couverture  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 5-6 jours
- **Assigné à**: À définir
- **Réviseur**: À définir
