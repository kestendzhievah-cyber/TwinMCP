import { EmbeddingModelConfig } from '../types/embeddings.types';

export const EMBEDDING_MODELS: Record<string, EmbeddingModelConfig> = {
  'text-embedding-3-small': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1KTokens: 0.00002,
    speed: 'fast',
    quality: 'good'
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    maxTokens: 8191,
    costPer1KTokens: 0.00013,
    speed: 'medium',
    quality: 'excellent'
  },
  'text-embedding-ada-002': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1KTokens: 0.00010,
    speed: 'medium',
    quality: 'good'
  }
} as const;

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const BATCH_SIZE_LIMIT = 100;
export const MAX_CONTENT_LENGTH = 8190;
export const EMBEDDING_CACHE_TTL = 86400;

export const RATE_LIMITS: Record<string, number> = {
  'text-embedding-3-small': 3000,
  'text-embedding-3-large': 3000,
  'text-embedding-ada-002': 3000
};

export const EMBEDDING_CONFIG = {
  defaultModel: DEFAULT_EMBEDDING_MODEL,
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: BATCH_SIZE_LIMIT,
  cacheTTL: EMBEDDING_CACHE_TTL,
  maxContentLength: MAX_CONTENT_LENGTH,
  rateLimitWindow: 60000,
  defaultRateLimit: 3000
};

export const VECTOR_SEARCH_CONFIG = {
  defaultThreshold: 0.7,
  maxResults: 100,
  includeMetadata: true,
  highlightLength: 200,
  maxHighlights: 3
};

export const ANALYTICS_CONFIG = {
  statsRetentionDays: 30,
  costAlertThreshold: 10,
  performanceAlertThreshold: 5000,
  cacheHitRateThreshold: 0.7,
  errorRateThreshold: 0.05
};

export const RELEVANCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.75,
  low: 0.0
};

export const CACHE_KEYS = {
  embedding: (content: string, model: string) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `embedding:${model}:${hash}`;
  },
  stats: (timeRange: string) => `cache_stats:${timeRange}`,
  rateLimit: (model: string) => `rate_limit:${model}`,
  embeddingStats: 'embedding_stats'
};

export const DATABASE_CONFIG = {
  vectorDimensions: {
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536
  },
  indexLists: 100,
  maxConnectionPool: 20,
  connectionTimeout: 30000
};
