import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OAuthController } from '../controllers/oauth.controller';
import { createAuthMiddleware } from '../middleware/oauth.middleware';
import { OAuthService } from '../services/oauth.service';
// Imports pour les types (utilisés dans les futures implémentations)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OAuthConfig } from '../types/oauth.types';

export class OAuthRoutes {
  private oauthController: OAuthController;
  private authMiddleware: ReturnType<typeof createAuthMiddleware>;

  constructor(oauthService: OAuthService) {
    this.oauthController = new OAuthController(oauthService);
    this.authMiddleware = createAuthMiddleware(oauthService);
  }

  async register(fastify: FastifyInstance): Promise<void> {
    // Middleware de sécurité pour toutes les routes OAuth
    fastify.addHook('preHandler', this.authMiddleware.security);

    // Endpoint d'autorisation (GET)
    fastify.get('/oauth/authorize', {
      config: {
        rateLimit: {
          max: 10, // Limiter à 10 demandes par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.authorizationEndpoint.bind(this.oauthController));

    // Endpoint de consentement (POST)
    fastify.post('/oauth/consent', {
      config: {
        rateLimit: {
          max: 5, // Limiter à 5 consentements par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.consentEndpoint.bind(this.oauthController));

    // Endpoint de token (POST)
    fastify.post('/oauth/token', {
      config: {
        rateLimit: {
          max: 20, // Limiter à 20 échanges par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.tokenEndpoint.bind(this.oauthController));

    // Endpoint de révocation (POST)
    fastify.post('/oauth/revoke', {
      config: {
        rateLimit: {
          max: 10, // Limiter à 10 révocations par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.revokeEndpoint.bind(this.oauthController));

    // Endpoint d'introspection (POST)
    fastify.post('/oauth/introspect', {
      config: {
        rateLimit: {
          max: 15, // Limiter à 15 introspections par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.introspectEndpoint.bind(this.oauthController));

    // Endpoint userinfo (GET)
    fastify.get('/oauth/userinfo', {
      preHandler: [this.authMiddleware.auth],
      config: {
        rateLimit: {
          max: 30, // Limiter à 30 requêtes par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.oauthController.userInfoEndpoint.bind(this.oauthController));

    // Endpoint de découverte OpenID Connect (GET)
    fastify.get('/.well-known/openid_configuration', {
      config: {
        rateLimit: {
          max: 5, // Limiter à 5 requêtes par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.openIdConfigurationHandler.bind(this));

    // Endpoint JWKS (GET)
    fastify.get('/.well-known/jwks.json', {
      config: {
        rateLimit: {
          max: 10, // Limiter à 10 requêtes par minute
          timeWindow: 60000 // 1 minute
        }
      }
    }, this.jwksHandler.bind(this));

    // Routes d'administration OAuth (protégées)
    fastify.register(async (protectedRoutes) => {
      // Middleware d'authentification admin
      const adminAuth = this.authMiddleware.authWithScopes(['admin']);
      protectedRoutes.addHook('preHandler', async (request, reply) => {
        for (const middleware of adminAuth) {
          await middleware(request, reply);
        }
      });

      // Liste des clients OAuth
      protectedRoutes.get('/admin/oauth/clients', this.listClientsHandler.bind(this));

      // Créer un client OAuth
      protectedRoutes.post('/admin/oauth/clients', this.createClientHandler.bind(this));

      // Révoquer tous les tokens d'un utilisateur
      protectedRoutes.delete('/admin/oauth/users/:userId/tokens', this.revokeUserTokensHandler.bind(this));

      // Nettoyer les tokens expirés
      protectedRoutes.post('/admin/oauth/cleanup', this.cleanupTokensHandler.bind(this));

      // Statistiques OAuth
      protectedRoutes.get('/admin/oauth/stats', this.oauthStatsHandler.bind(this));
    }, { prefix: '/api' });
  }

  private async openIdConfigurationHandler(_request: any, reply: any) {
    const issuer = process.env['OAUTH_ISSUER'] || 'https://api.twinmcp.com';
    
    const configuration = {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: ['openid', 'profile', 'email', 'read', 'write', 'admin'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256', 'plain'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      userinfo_signing_alg_values_supported: ['none']
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Cache-Control', 'public, max-age=3600'); // 1 heure
    return reply.send(configuration);
  }

  private async jwksHandler(_request: any, reply: any) {
    // Pour l'instant, nous utilisons HS256 (symétrique)
    // Si nous passons à RS256 (asymétrique), nous devrons générer des clés RSA
    const jwks = {
      keys: [
        {
          kty: 'oct', // Octet string sequence (pour HS256)
          alg: 'HS256',
          use: 'sig',
          kid: '1',
          k: process.env['JWT_SECRET'] ? Buffer.from(process.env['JWT_SECRET']).toString('base64url') : ''
        }
      ]
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Cache-Control', 'public, max-age=86400'); // 24 heures
    return reply.send(jwks);
  }

  private async listClientsHandler(_request: any, reply: any) {
    // TODO: Implémenter la liste des clients OAuth
    reply.send({
      clients: [],
      message: 'Endpoint à implémenter'
    });
  }

  private async createClientHandler(_request: any, reply: any) {
    // TODO: Implémenter la création de clients OAuth
    reply.send({
      message: 'Endpoint à implémenter'
    });
  }

  private async revokeUserTokensHandler(_request: any, reply: any) {
    // TODO: Implémenter la révocation des tokens utilisateur
    reply.send({
      message: 'Endpoint à implémenter'
    });
  }

  private async cleanupTokensHandler(_request: any, reply: any) {
    // TODO: Implémenter le nettoyage des tokens expirés
    reply.send({
      message: 'Endpoint à implémenter'
    });
  }

  private async oauthStatsHandler(_request: any, reply: any) {
    // TODO: Implémenter les statistiques OAuth
    reply.send({
      message: 'Endpoint à implémenter'
    });
  }

  // Méthode statique pour l'enregistrement
  static async register(server: FastifyInstance, options: { oauthService: OAuthService }): Promise<void> {
    const oauthRoutes = new OAuthRoutes(options.oauthService);
    await oauthRoutes.register(server);
  }
}

// Export du plugin Fastify
export const oauthRoutesPlugin: FastifyPluginAsync<{ oauthService: OAuthService }> = async (fastify, options) => {
  await OAuthRoutes.register(fastify, options);
};
