// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    session?: {
      userId: string;
    };
  }

  interface FastifyReply {
    view(template: string, data?: any): FastifyReply;
  }
}

import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuthService } from '../services/oauth.service';
import { 
  OAuthAuthorizationRequest, 
  OAuthTokenRequest, 
  OAuthTokenResponse,
  OAuthError 
} from '../types/oauth.types';

export class OAuthController {
  constructor(private oauthService: OAuthService) {}

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
      } = request.query as OAuthAuthorizationRequest;

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
        user: request.session.userId // À remplacer avec les vraies infos utilisateur
      });

    } catch (error) {
      // Rediriger avec erreur
      const errorParams = new URLSearchParams({
        error: 'invalid_request',
        error_description: (error as Error).message
      });

      if ((request.query as any).state) {
        errorParams.append('state', (request.query as any).state);
      }

      return reply.redirect(`${(request.query as any).redirect_uri}?${errorParams.toString()}`);
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
      request.log.error({ msg: 'OAuth consent error', error: (error as Error).message });
      
      const errorParams = new URLSearchParams({
        error: 'server_error',
        error_description: 'Erreur interne du serveur'
      });

      if ((request.body as any).state) {
        errorParams.append('state', (request.body as any).state);
      }

      return reply.redirect(`${(request.body as any).redirect_uri}?${errorParams.toString()}`);
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
      } = request.body as OAuthTokenRequest;

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

      reply.header('Content-Type', 'application/json');
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
      return reply.send(tokenResponse);

    } catch (error) {
      request.log.error({ msg: 'OAuth token error', error: (error as Error).message });
      
      const errorResponse: OAuthError = {
        error: 'invalid_grant',
        error_description: (error as Error).message
      };

      reply.status(400);
      reply.header('Content-Type', 'application/json');
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
      return reply.send(errorResponse);
    }
  }

  async revokeEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        token,
        token_type_hint,
        client_id,
        client_secret
      } = request.body as any;

      if (!token) {
        throw new Error('Token requis');
      }

      // Valider le client
      const client = await this.oauthService.validateClient(client_id, client_secret);
      if (!client) {
        throw new Error('Client invalide');
      }

      // Déterminer le type de token
      let tokenType: 'access' | 'refresh';
      if (token_type_hint === 'refresh_token') {
        tokenType = 'refresh';
      } else {
        tokenType = 'access';
      }

      // Révoquer le token
      const success = await this.oauthService.revokeToken(token, tokenType);

      if (success) {
        reply.status(200);
        return reply.send();
      } else {
        reply.status(400);
        return reply.send({
          error: 'invalid_request',
          error_description: 'Token invalide ou déjà révoqué'
        });
      }

    } catch (error) {
      request.log.error({ msg: 'OAuth revoke error', error: (error as Error).message });
      
      reply.status(400);
      return reply.send({
        error: 'invalid_request',
        error_description: (error as Error).message
      });
    }
  }

  async introspectEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        token,
        client_id,
        client_secret
      } = request.body as any;

      if (!token) {
        throw new Error('Token requis');
      }

      // Valider le client
      const client = await this.oauthService.validateClient(client_id, client_secret);
      if (!client) {
        throw new Error('Client invalide');
      }

      // Obtenir les informations du token
      const tokenInfo = await this.oauthService.getTokenInfo(token);

      if (!tokenInfo) {
        return reply.send({
          active: false
        });
      }

      const response = {
        active: true,
        scope: tokenInfo.scopes.join(' '),
        client_id: tokenInfo.clientId,
        token_type: tokenInfo.type,
        exp: Math.floor(tokenInfo.expiresAt.getTime() / 1000),
        iat: Math.floor(tokenInfo.createdAt.getTime() / 1000),
        sub: tokenInfo.userId
      };

      return reply.send(response);

    } catch (error) {
      request.log.error({ msg: 'OAuth introspect error', error: (error as Error).message });
      
      reply.status(400);
      return reply.send({
        error: 'invalid_request',
        error_description: (error as Error).message
      });
    }
  }

  async userInfoEndpoint(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401);
        return reply.send({
          error: 'invalid_token',
          error_description: 'Token d\'accès manquant'
        });
      }

      const token = authHeader.substring(7);
      const tokenData = await this.oauthService.validateAccessToken(token);

      if (!tokenData) {
        reply.status(401);
        return reply.send({
          error: 'invalid_token',
          error_description: 'Token d\'accès invalide ou expiré'
        });
      }

      // Vérifier le scope openid
      if (!tokenData.scopes.includes('openid')) {
        reply.status(403);
        return reply.send({
          error: 'insufficient_scope',
          error_description: 'Scope openid requis'
        });
      }

      // Récupérer les informations utilisateur
      // TODO: Implémenter la récupération des infos utilisateur depuis la base de données
      const userInfo = {
        sub: tokenData.userId,
        email: 'user@example.com', // À remplacer avec les vraies données
        name: 'User Name', // À remplacer avec les vraies données
        email_verified: true
      };

      // Filtrer selon les scopes
      const filteredUserInfo: any = {
        sub: userInfo.sub
      };

      if (tokenData.scopes.includes('email')) {
        filteredUserInfo.email = userInfo.email;
        filteredUserInfo.email_verified = userInfo.email_verified;
      }

      if (tokenData.scopes.includes('profile')) {
        filteredUserInfo.name = userInfo.name;
      }

      reply.header('Content-Type', 'application/json');
      return reply.send(filteredUserInfo);

    } catch (error) {
      request.log.error({ msg: 'OAuth userinfo error', error: (error as Error).message });
      
      reply.status(500);
      return reply.send({
        error: 'server_error',
        error_description: 'Erreur interne du serveur'
      });
    }
  }

  private validateScopes(requested: string[], allowed: string[]): string[] {
    return requested.filter(scope => allowed.includes(scope));
  }
}
