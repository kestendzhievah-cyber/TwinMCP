export interface OAuthConfig {
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

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: ('authorization_code' | 'client_credentials' | 'refresh_token')[];
  requirePKCE: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface AuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}

export interface AccessToken {
  id: string;
  tokenHash: string;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
}

export interface RefreshToken {
  id: string;
  tokenHash: string;
  accessTokenId: string;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
  isRevoked: boolean;
}

export interface CleanupResult {
  accessTokensDeleted: number;
  refreshTokensDeleted: number;
  authorizationCodesDeleted: number;
  timestamp: Date;
}

export interface TokenInfo {
  type: 'access' | 'refresh';
  clientId: string;
  clientName: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
  isRevoked?: boolean;
}

export interface UserTokens {
  accessTokens: any[];
  refreshTokens: any[];
}

export interface OAuthAuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface OAuthTokenRequest {
  grant_type: 'authorization_code' | 'refresh_token' | 'client_credentials';
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthError {
  error: 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unauthorized_client' | 'unsupported_grant_type' | 'invalid_scope' | 'access_denied' | 'server_error';
  error_description?: string;
  error_uri?: string;
  state?: string;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: any;
}

export interface TokenIntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
}
