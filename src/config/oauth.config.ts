import { logger } from '../utils/logger';
import { OAuthConfig } from '../types/oauth.types';

export const oauthConfig: OAuthConfig = {
  authorizationServer: {
    issuer: process.env['OAUTH_ISSUER'] || 'https://api.twinmcp.com',
    authorizationEndpoint: process.env['OAUTH_AUTHORIZATION_ENDPOINT'] || '/oauth/authorize',
    tokenEndpoint: process.env['OAUTH_TOKEN_ENDPOINT'] || '/oauth/token',
    userInfoEndpoint: process.env['OAUTH_USERINFO_ENDPOINT'] || '/oauth/userinfo',
    revocationEndpoint: process.env['OAUTH_REVOCATION_ENDPOINT'] || '/oauth/revoke'
  },
  clients: new Map(),
  supportedScopes: [
    'read',      // Lire les données
    'write',     // Écrire les données  
    'admin',     // Accès administrateur
    'openid',    // OpenID Connect authentication
    'profile',   // Accès au profil utilisateur
    'email'      // Accès à l'email
  ],
  tokenConfig: {
    accessTokenLifetime: parseInt(process.env['OAUTH_ACCESS_TOKEN_LIFETIME'] || '3600'),    // 1 heure
    refreshTokenLifetime: parseInt(process.env['OAUTH_REFRESH_TOKEN_LIFETIME'] || '2592000'), // 30 jours
    idTokenLifetime: parseInt(process.env['OAUTH_ID_TOKEN_LIFETIME'] || '3600')         // 1 heure
  }
};

// Configuration des scopes avec descriptions
export const scopeDescriptions = {
  read: {
    name: 'Lire les données',
    description: 'Permet de lire vos données et configurations',
    icon: '📖'
  },
  write: {
    name: 'Écrire les données', 
    description: 'Permet de modifier vos données et configurations',
    icon: '✏️'
  },
  admin: {
    name: 'Accès administrateur',
    description: 'Permet un accès complet à toutes les fonctionnalités',
    icon: '🔐'
  },
  openid: {
    name: 'Authentification OpenID',
    description: 'Permet l\'authentification via OpenID Connect',
    icon: '🔑'
  },
  profile: {
    name: 'Profil utilisateur',
    description: 'Permet d\'accéder à votre profil de base',
    icon: '👤'
  },
  email: {
    name: 'Adresse email',
    description: 'Permet d\'accéder à votre adresse email',
    icon: '📧'
  }
};

// Helper functions pour les templates
export const getScopeIcon = (scope: string): string => {
  return scopeDescriptions[scope as keyof typeof scopeDescriptions]?.icon || '🔒';
};

export const getScopeName = (scope: string): string => {
  return scopeDescriptions[scope as keyof typeof scopeDescriptions]?.name || scope;
};

export const getScopeDescription = (scope: string): string => {
  return scopeDescriptions[scope as keyof typeof scopeDescriptions]?.description || 'Permission personnalisée';
};

// Configuration des clients OAuth par défaut (pour développement)
export const defaultOAuthClients = [
  {
    clientId: 'twinmcp-ide-plugin',
    clientSecretHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // 'ide-plugin-secret'
    name: 'TwinMCP IDE Plugin',
    redirectUris: [
      'http://localhost:3000/oauth/callback',
      'vscode://twinmcp/oauth/callback',
      'cursor://twinmcp/oauth/callback'
    ],
    allowedScopes: ['read', 'write'],
    grantTypes: ['authorization_code', 'refresh_token'] as const,
    requirePkce: true,
    isActive: true
  },
  {
    clientId: 'twinmcp-web-app',
    clientSecretHash: '2c70e12b7d7a5e2a4c3b5e1a8d7a9f4b1c3e8e7b6a5d4f3e2c1b9d8a7f6e5d4c3b2a1e9f8e7d6a5c4b3e2a1f9e8d7b6a5d4f3e2c1b9d8a7f6e5d4c3b2a1e9f8',
    name: 'TwinMCP Web Application',
    redirectUris: [
      'https://app.twinmcp.com/oauth/callback',
      'https://staging.twinmcp.com/oauth/callback'
    ],
    allowedScopes: ['read', 'write', 'openid', 'profile', 'email'],
    grantTypes: ['authorization_code', 'refresh_token'] as const,
    requirePkce: false,
    isActive: true
  },
  {
    clientId: 'twinmcp-cli',
    clientSecretHash: '8f7e6d5c4b3a2e1f9d8a7b6c5d4f3e2c1b9d8a7f6e5d4c3b2a1e9f8e7d6a5c4b3e2a1f9d8a7b6c5d4f3',
    name: 'TwinMCP CLI',
    redirectUris: [
      'http://localhost:8080/oauth/callback',
      'urn:ietf:wg:oauth:2.0:oob'
    ],
    allowedScopes: ['read', 'write', 'admin'],
    grantTypes: ['authorization_code', 'refresh_token'] as const,
    requirePkce: true,
    isActive: true
  }
];

// Validation des configurations
export const validateOAuthConfig = (): void => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  }

  // Validation des durées de vie des tokens
  if (oauthConfig.tokenConfig.accessTokenLifetime < 300) {
    logger.warn('OAUTH_ACCESS_TOKEN_LIFETIME est trop court (minimum 300 secondes)');
  }

  if (oauthConfig.tokenConfig.refreshTokenLifetime < 86400) {
    logger.warn('OAUTH_REFRESH_TOKEN_LIFETIME est trop court (minimum 86400 secondes)');
  }

  // Validation de l'issuer
  if (!oauthConfig.authorizationServer.issuer.startsWith('https://') && 
      !oauthConfig.authorizationServer.issuer.startsWith('http://localhost')) {
    logger.warn('OAUTH_ISSUER devrait utiliser HTTPS en production');
  }
};

export default oauthConfig;
