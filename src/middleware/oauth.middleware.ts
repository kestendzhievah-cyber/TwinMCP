import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuthService } from '../services/oauth.service';
import { AccessToken } from '../types/oauth.types';

// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    oauthToken?: AccessToken;
  }
}

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

  requireScopes(requiredScopes: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      const hasAllScopes = requiredScopes.every(scope => 
        request.oauthToken!.scopes.includes(scope)
      );

      if (!hasAllScopes) {
        reply.status(403).send({
          error: 'insufficient_scope',
          error_description: `Scopes requis: ${requiredScopes.join(', ')}`
        });
        return;
      }
    };
  }

  requireAnyScope(requiredScopes: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      const hasAnyScope = requiredScopes.some(scope => 
        request.oauthToken!.scopes.includes(scope)
      );

      if (!hasAnyScope) {
        reply.status(403).send({
          error: 'insufficient_scope',
          error_description: `Un des scopes requis: ${requiredScopes.join(', ')}`
        });
        return;
      }
    };
  }

  optional() {
    return async (_request: FastifyRequest, _reply: FastifyReply) => {
      const authHeader = _request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return; // Pas d'authentification, continuer
      }

      const token = authHeader.substring(7);
      const tokenData = await this.oauthService.validateAccessToken(token);

      if (tokenData) {
        _request.oauthToken = tokenData;
      }
      // Si le token est invalide, on continue sans authentification (optionnelle)
    };
  }

  // Middleware pour vérifier si le token appartient à l'utilisateur actuel
  requireOwnership(userIdParam: string = 'userId') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      const requestedUserId = (request.params as any)[userIdParam];
      
      if (request.oauthToken.userId !== requestedUserId) {
        reply.status(403).send({
          error: 'access_denied',
          error_description: 'Accès non autorisé à cette ressource'
        });
        return;
      }
    };
  }

  // Middleware pour limiter l'accès aux clients spécifiques
  requireClient(allowedClientIds: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      if (!allowedClientIds.includes(request.oauthToken.clientId)) {
        reply.status(403).send({
          error: 'access_denied',
          error_description: 'Client non autorisé'
        });
        return;
      }
    };
  }

  // Middleware pour vérifier l'expiration du token
  requireValidToken() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.oauthToken) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Authentification requise'
        });
        return;
      }

      if (new Date() > request.oauthToken.expiresAt) {
        reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Token expiré'
        });
        return;
      }
    };
  }

  // Middleware pour ajouter les headers CORS pour OAuth
  oauthCors() {
    return async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
      reply.header('Access-Control-Expose-Headers', 'WWW-Authenticate');
      reply.header('Access-Control-Max-Age', '86400'); // 24 hours

      if (_request.method === 'OPTIONS') {
        reply.status(200).send();
        return;
      }
    };
  }

  // Middleware pour ajouter les headers de sécurité OAuth
  securityHeaders() {
    return async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    };
  }
}

// Fonctions utilitaires pour créer des middlewares combinés
export const createAuthMiddleware = (oauthService: OAuthService) => {
  const middleware = new OAuthMiddleware(oauthService);

  return {
    // Authentification simple
    auth: middleware.authenticate(),
    
    // Authentification avec scope requis
    authWithScope: (scope: string) => [
      middleware.authenticate(),
      middleware.requireScope(scope)
    ],
    
    // Authentification avec scopes requis (tous)
    authWithScopes: (scopes: string[]) => [
      middleware.authenticate(),
      middleware.requireScopes(scopes)
    ],
    
    // Authentification avec un des scopes requis
    authWithAnyScope: (scopes: string[]) => [
      middleware.authenticate(),
      middleware.requireAnyScope(scopes)
    ],
    
    // Authentification optionnelle
    optionalAuth: middleware.optional(),
    
    // Propriété de la ressource
    owner: (userIdParam?: string) => [
      middleware.authenticate(),
      middleware.requireOwnership(userIdParam)
    ],
    
    // Client spécifique
    client: (allowedClientIds: string[]) => [
      middleware.authenticate(),
      middleware.requireClient(allowedClientIds)
    ],
    
    // Headers CORS et sécurité
    cors: middleware.oauthCors(),
    security: middleware.securityHeaders(),
    
    // Middleware complet avec CORS et sécurité
    secure: [
      middleware.oauthCors(),
      middleware.securityHeaders()
    ]
  };
};
