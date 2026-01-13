
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
} = require('./runtime/index-browser')


const Prisma = {}

exports.Prisma = Prisma

/**
 * Prisma Client JS version: 5.0.0
 * Query Engine version: 6b0aef69b7cdfc787f822ecd7cdc76d5f1991584
 */
Prisma.prismaVersion = {
  client: "5.0.0",
  engine: "6b0aef69b7cdfc787f822ecd7cdc76d5f1991584"
}

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  throw new Error(`Extensions.getExtensionContext is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.defineExtension = () => {
  throw new Error(`Extensions.defineExtension is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  domain: 'domain',
  apiKeys: 'apiKeys',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModuleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  version: 'version'
};

exports.Prisma.ModuleOnClientScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  moduleId: 'moduleId',
  enabled: 'enabled'
};

exports.Prisma.EnvironmentVariableScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  environment: 'environment',
  clientId: 'clientId'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  avatar: 'avatar',
  hashedPassword: 'hashedPassword',
  oauthProvider: 'oauthProvider',
  oauthId: 'oauthId',
  role: 'role',
  clientId: 'clientId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LibraryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  displayName: 'displayName',
  description: 'description',
  vendor: 'vendor',
  repoUrl: 'repoUrl',
  docsUrl: 'docsUrl',
  defaultVersion: 'defaultVersion',
  popularityScore: 'popularityScore',
  totalSnippets: 'totalSnippets',
  totalTokens: 'totalTokens',
  language: 'language',
  ecosystem: 'ecosystem',
  tags: 'tags',
  metadata: 'metadata',
  clientId: 'clientId',
  lastCrawledAt: 'lastCrawledAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LibraryVersionScalarFieldEnum = {
  id: 'id',
  libraryId: 'libraryId',
  version: 'version',
  releaseDate: 'releaseDate',
  isLatest: 'isLatest',
  docsSnapshotUrl: 'docsSnapshotUrl'
};

exports.Prisma.LibraryAliasScalarFieldEnum = {
  id: 'id',
  libraryId: 'libraryId',
  alias: 'alias'
};

exports.Prisma.DocumentationChunkScalarFieldEnum = {
  id: 'id',
  libraryVersionId: 'libraryVersionId',
  chunkIndex: 'chunkIndex',
  content: 'content',
  contentType: 'contentType',
  sourceUrl: 'sourceUrl',
  tokenCount: 'tokenCount',
  embeddingId: 'embeddingId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  libraryId: 'libraryId'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  keyHash: 'keyHash',
  keyPrefix: 'keyPrefix',
  name: 'name',
  tier: 'tier',
  quotaDaily: 'quotaDaily',
  quotaMonthly: 'quotaMonthly',
  usedDaily: 'usedDaily',
  usedMonthly: 'usedMonthly',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  isActive: 'isActive',
  permissions: 'permissions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  revokedAt: 'revokedAt'
};

exports.Prisma.UsageLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  apiKeyId: 'apiKeyId',
  libraryId: 'libraryId',
  toolName: 'toolName',
  query: 'query',
  tokensReturned: 'tokensReturned',
  responseTimeMs: 'responseTimeMs',
  createdAt: 'createdAt'
};

exports.Prisma.MCPConfigurationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  configData: 'configData',
  status: 'status',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OAuthTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.OAuthClientScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  clientSecretHash: 'clientSecretHash',
  name: 'name',
  redirectUris: 'redirectUris',
  allowedScopes: 'allowedScopes',
  grantTypes: 'grantTypes',
  requirePkce: 'requirePkce',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OAuthAuthorizationCodeScalarFieldEnum = {
  id: 'id',
  code: 'code',
  clientId: 'clientId',
  userId: 'userId',
  redirectUri: 'redirectUri',
  scopes: 'scopes',
  codeChallenge: 'codeChallenge',
  codeChallengeMethod: 'codeChallengeMethod',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.OAuthAccessTokenScalarFieldEnum = {
  id: 'id',
  tokenHash: 'tokenHash',
  clientId: 'clientId',
  userId: 'userId',
  scopes: 'scopes',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.OAuthRefreshTokenScalarFieldEnum = {
  id: 'id',
  tokenHash: 'tokenHash',
  accessTokenId: 'accessTokenId',
  clientId: 'clientId',
  userId: 'userId',
  scopes: 'scopes',
  expiresAt: 'expiresAt',
  isRevoked: 'isRevoked',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.Environment = {
  DEVELOPMENT: 'DEVELOPMENT',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION'
};

exports.Role = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN'
};

exports.ConfigStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TESTING: 'TESTING',
  ERROR: 'ERROR'
};

exports.Prisma.ModelName = {
  Client: 'Client',
  Module: 'Module',
  ModuleOnClient: 'ModuleOnClient',
  EnvironmentVariable: 'EnvironmentVariable',
  User: 'User',
  Library: 'Library',
  LibraryVersion: 'LibraryVersion',
  LibraryAlias: 'LibraryAlias',
  DocumentationChunk: 'DocumentationChunk',
  ApiKey: 'ApiKey',
  UsageLog: 'UsageLog',
  MCPConfiguration: 'MCPConfiguration',
  OAuthToken: 'OAuthToken',
  OAuthClient: 'OAuthClient',
  OAuthAuthorizationCode: 'OAuthAuthorizationCode',
  OAuthAccessToken: 'OAuthAccessToken',
  OAuthRefreshToken: 'OAuthRefreshToken'
};

/**
 * Create the Client
 */
class PrismaClient {
  constructor() {
    throw new Error(
      `PrismaClient is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
    )
  }
}
exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
