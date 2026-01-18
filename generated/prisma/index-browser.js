
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

exports.Prisma.DownloadTaskScalarFieldEnum = {
  id: 'id',
  type: 'type',
  source: 'source',
  options: 'options',
  priority: 'priority',
  status: 'status',
  progress: 'progress',
  metadata: 'metadata',
  created_at: 'created_at',
  started_at: 'started_at',
  completed_at: 'completed_at',
  error: 'error',
  retry_count: 'retry_count'
};

exports.Prisma.DownloadResultScalarFieldEnum = {
  id: 'id',
  task_id: 'task_id',
  success: 'success',
  local_path: 'local_path',
  metadata: 'metadata',
  files: 'files',
  errors: 'errors',
  created_at: 'created_at'
};

exports.Prisma.PromptCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  parentCategory: 'parentCategory',
  icon: 'icon',
  color: 'color',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PromptTemplateScalarFieldEnum = {
  id: 'id',
  version: 'version',
  name: 'name',
  description: 'description',
  category: 'category',
  status: 'status',
  template: 'template',
  variables: 'variables',
  examples: 'examples',
  metadata: 'metadata',
  constraints: 'constraints',
  optimization: 'optimization',
  testing: 'testing',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TemplateChangeScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  fromVersion: 'fromVersion',
  toVersion: 'toVersion',
  changes: 'changes',
  createdAt: 'createdAt'
};

exports.Prisma.PromptExecutionScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  templateVersion: 'templateVersion',
  variables: 'variables',
  renderedPrompt: 'renderedPrompt',
  context: 'context',
  model: 'model',
  provider: 'provider',
  response: 'response',
  metrics: 'metrics',
  quality: 'quality',
  feedback: 'feedback',
  abTestVariant: 'abTestVariant',
  userId: 'userId',
  createdAt: 'createdAt'
};

exports.Prisma.PromptExecutionErrorScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  variables: 'variables',
  errorMessage: 'errorMessage',
  context: 'context',
  createdAt: 'createdAt'
};

exports.Prisma.ABTestScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  variants: 'variants',
  trafficSplit: 'trafficSplit',
  startDate: 'startDate',
  endDate: 'endDate',
  sampleSize: 'sampleSize',
  confidence: 'confidence',
  results: 'results',
  createdAt: 'createdAt'
};

exports.Prisma.OptimizationRecordScalarFieldEnum = {
  id: 'id',
  templateId: 'templateId',
  timestamp: 'timestamp',
  type: 'type',
  reason: 'reason',
  changes: 'changes',
  metricsBefore: 'metricsBefore',
  metricsAfter: 'metricsAfter',
  improvement: 'improvement',
  createdAt: 'createdAt'
};

exports.Prisma.ConversationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  metadata: 'metadata',
  settings: 'settings',
  analytics: 'analytics',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  timestamp: 'timestamp',
  metadata: 'metadata'
};

exports.Prisma.MessageReactionScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  userId: 'userId',
  emoji: 'emoji',
  timestamp: 'timestamp'
};

exports.Prisma.MessageAttachmentScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  type: 'type',
  name: 'name',
  url: 'url',
  size: 'size',
  mimeType: 'mimeType',
  metadata: 'metadata',
  thumbnail: 'thumbnail'
};

exports.Prisma.ConversationShareScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  shareId: 'shareId',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt',
  permissions: 'permissions',
  settings: 'settings',
  analytics: 'analytics'
};

exports.Prisma.ConversationExportScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  format: 'format',
  options: 'options',
  status: 'status',
  downloadUrl: 'downloadUrl',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  completedAt: 'completedAt',
  error: 'error'
};

exports.Prisma.ContextSourceScalarFieldEnum = {
  id: 'id',
  type: 'type',
  title: 'title',
  content: 'content',
  url: 'url',
  libraryId: 'libraryId',
  version: 'version',
  language: 'language',
  tags: 'tags',
  relevanceScore: 'relevanceScore',
  freshness: 'freshness',
  popularity: 'popularity',
  lastUpdated: 'lastUpdated',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContextChunkScalarFieldEnum = {
  id: 'id',
  sourceId: 'sourceId',
  content: 'content',
  positionStart: 'positionStart',
  positionEnd: 'positionEnd',
  positionIndex: 'positionIndex',
  positionTotal: 'positionTotal',
  sectionTitle: 'sectionTitle',
  codeBlocks: 'codeBlocks',
  links: 'links',
  images: 'images',
  complexity: 'complexity',
  embedding: 'embedding',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContextQueryScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  messageId: 'messageId',
  queryText: 'queryText',
  intentType: 'intentType',
  intentConfidence: 'intentConfidence',
  intentKeywords: 'intentKeywords',
  intentCategory: 'intentCategory',
  intentSubcategory: 'intentSubcategory',
  entities: 'entities',
  filters: 'filters',
  options: 'options',
  createdAt: 'createdAt'
};

exports.Prisma.ContextResultScalarFieldEnum = {
  id: 'id',
  queryId: 'queryId',
  sources: 'sources',
  chunks: 'chunks',
  summary: 'summary',
  totalSources: 'totalSources',
  totalChunks: 'totalChunks',
  queryTime: 'queryTime',
  relevanceScore: 'relevanceScore',
  coverage: 'coverage',
  freshness: 'freshness',
  suggestions: 'suggestions',
  createdAt: 'createdAt'
};

exports.Prisma.ContextInjectionScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  messageId: 'messageId',
  context: 'context',
  templateId: 'templateId',
  injectedPrompt: 'injectedPrompt',
  originalLength: 'originalLength',
  injectedLength: 'injectedLength',
  compressionRatio: 'compressionRatio',
  relevanceScore: 'relevanceScore',
  createdAt: 'createdAt'
};

exports.Prisma.ContextTemplateScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  template: 'template',
  variables: 'variables',
  description: 'description',
  version: 'version',
  usageCount: 'usageCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContextQueryAnalyticsScalarFieldEnum = {
  id: 'id',
  queryId: 'queryId',
  conversationId: 'conversationId',
  queryText: 'queryText',
  intent: 'intent',
  entities: 'entities',
  filters: 'filters',
  options: 'options',
  resultMetadata: 'resultMetadata',
  createdAt: 'createdAt'
};

exports.Prisma.ContextCacheScalarFieldEnum = {
  id: 'id',
  cacheKey: 'cacheKey',
  queryText: 'queryText',
  result: 'result',
  expiresAt: 'expiresAt',
  hitCount: 'hitCount',
  lastAccessed: 'lastAccessed',
  createdAt: 'createdAt'
};

exports.Prisma.UserPreferencesScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  preferences: 'preferences',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ThemeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  category: 'category',
  colors: 'colors',
  typography: 'typography',
  spacing: 'spacing',
  shadows: 'shadows',
  borderRadius: 'borderRadius',
  animations: 'animations',
  custom: 'custom',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PersonalizationAnalyticsScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  actionType: 'actionType',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.UserProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  postalCode: 'postalCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  number: 'number',
  userId: 'userId',
  status: 'status',
  period: 'period',
  issueDate: 'issueDate',
  dueDate: 'dueDate',
  paidDate: 'paidDate',
  subtotal: 'subtotal',
  tax: 'tax',
  total: 'total',
  currency: 'currency',
  items: 'items',
  billingAddress: 'billingAddress',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  userId: 'userId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  providerTransactionId: 'providerTransactionId',
  failureReason: 'failureReason',
  refundedAmount: 'refundedAmount',
  createdAt: 'createdAt',
  processedAt: 'processedAt',
  metadata: 'metadata'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  plan: 'plan',
  status: 'status',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  amount: 'amount',
  currency: 'currency',
  interval: 'interval',
  intervalCount: 'intervalCount',
  trialStart: 'trialStart',
  trialEnd: 'trialEnd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  metadata: 'metadata'
};

exports.Prisma.CreditScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  amount: 'amount',
  currency: 'currency',
  reason: 'reason',
  type: 'type',
  expiresAt: 'expiresAt',
  usedAt: 'usedAt',
  invoiceId: 'invoiceId',
  createdAt: 'createdAt',
  metadata: 'metadata'
};

exports.Prisma.BillingAlertScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  threshold: 'threshold',
  currentValue: 'currentValue',
  message: 'message',
  isRead: 'isRead',
  createdAt: 'createdAt',
  readAt: 'readAt',
  metadata: 'metadata'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  interval: 'interval',
  features: 'features',
  limits: 'limits',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  metadata: 'metadata'
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

exports.InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED'
};

exports.PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

exports.SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

exports.SubscriptionInterval = {
  MONTH: 'MONTH',
  YEAR: 'YEAR'
};

exports.CreditType = {
  PROMOTIONAL: 'PROMOTIONAL',
  REFUND: 'REFUND',
  COMPENSATION: 'COMPENSATION',
  ADJUSTMENT: 'ADJUSTMENT'
};

exports.BillingAlertType = {
  USAGE_THRESHOLD: 'USAGE_THRESHOLD',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVOICE_OVERDUE: 'INVOICE_OVERDUE',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING'
};

exports.PlanInterval = {
  MONTH: 'MONTH',
  YEAR: 'YEAR'
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
  OAuthRefreshToken: 'OAuthRefreshToken',
  DownloadTask: 'DownloadTask',
  DownloadResult: 'DownloadResult',
  PromptCategory: 'PromptCategory',
  PromptTemplate: 'PromptTemplate',
  TemplateChange: 'TemplateChange',
  PromptExecution: 'PromptExecution',
  PromptExecutionError: 'PromptExecutionError',
  ABTest: 'ABTest',
  OptimizationRecord: 'OptimizationRecord',
  Conversation: 'Conversation',
  Message: 'Message',
  MessageReaction: 'MessageReaction',
  MessageAttachment: 'MessageAttachment',
  ConversationShare: 'ConversationShare',
  ConversationExport: 'ConversationExport',
  ContextSource: 'ContextSource',
  ContextChunk: 'ContextChunk',
  ContextQuery: 'ContextQuery',
  ContextResult: 'ContextResult',
  ContextInjection: 'ContextInjection',
  ContextTemplate: 'ContextTemplate',
  ContextQueryAnalytics: 'ContextQueryAnalytics',
  ContextCache: 'ContextCache',
  UserPreferences: 'UserPreferences',
  Theme: 'Theme',
  PersonalizationAnalytics: 'PersonalizationAnalytics',
  UserProfile: 'UserProfile',
  Invoice: 'Invoice',
  Payment: 'Payment',
  Subscription: 'Subscription',
  Credit: 'Credit',
  BillingAlert: 'BillingAlert',
  Plan: 'Plan'
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
