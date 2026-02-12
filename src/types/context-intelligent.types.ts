export interface ContextSource {
  id: string;
  type: 'documentation' | 'code' | 'example' | 'api' | 'tutorial';
  title: string;
  content: string;
  url?: string;
  metadata: {
    libraryId?: string;
    version?: string;
    language: string;
    tags: string[];
    relevanceScore: number;
    freshness: number;
    popularity: number;
    lastUpdated: Date;
  };
  embeddings?: number[];
  chunks: ContextChunk[];
}

export interface ContextChunk {
  id: string;
  sourceId: string;
  content: string;
  position: {
    start: number;
    end: number;
    index: number;
    total: number;
  };
  metadata: {
    sectionTitle?: string;
    codeBlocks: number;
    links: number;
    images: number;
    complexity: 'low' | 'medium' | 'high';
  };
  embeddings?: number[];
}

export interface ContextQuery {
  id: string;
  conversationId: string;
  messageId: string;
  query: string;
  intent: QueryIntent;
  entities: QueryEntity[];
  filters: ContextFilters;
  options: ContextOptions;
  timestamp: Date;
}

export interface QueryIntent {
  type: 'question' | 'explanation' | 'example' | 'troubleshooting' | 'comparison' | 'tutorial';
  confidence: number;
  keywords: string[];
  category: string;
  subcategory?: string;
}

export interface QueryEntity {
  text: string;
  type: 'library' | 'function' | 'class' | 'concept' | 'technology' | 'version';
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

export interface ContextFilters {
  libraries?: string[];
  languages?: string[];
  types?: ContextSource['type'][];
  dateRange?: {
    start: Date;
    end: Date;
  };
  minRelevance?: number;
  maxResults?: number;
  excludeOutdated?: boolean;
}

export interface ContextOptions {
  includeCode: boolean;
  includeExamples: boolean;
  includeAPI: boolean;
  preferRecent: boolean;
  maxContextLength: number;
  chunkOverlap: number;
  diversityThreshold: number;
  rerankResults: boolean;
  maxResults?: number;
}

export interface ContextResult {
  queryId: string;
  sources: ContextSource[];
  chunks: ContextChunk[];
  summary: string;
  metadata: {
    totalSources: number;
    totalChunks: number;
    queryTime: number;
    relevanceScore: number;
    coverage: number;
    freshness: number;
  };
  suggestions: ContextSuggestion[];
}

export interface ContextSuggestion {
  type: 'related_query' | 'clarification' | 'example' | 'documentation';
  text: string;
  reason: string;
  confidence: number;
}

export interface ContextInjection {
  conversationId: string;
  messageId: string;
  context: ContextResult;
  template: string;
  injectedPrompt: string;
  metadata: {
    originalLength: number;
    injectedLength: number;
    compressionRatio: number;
    relevanceScore: number;
  };
}

export interface ContextAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    averageRelevance: number;
  };
  sources: {
    mostUsed: Array<{ source: string; count: number }>;
    averageRelevance: number;
    freshness: number;
  };
  performance: {
    cacheHitRate: number;
    queryTime: {
      p50: number;
      p95: number;
      p99: number;
    };
    contextQuality: number;
  };
}

export interface ContextCache {
  key: string;
  query: string;
  result: ContextResult;
  expiresAt: Date;
  hitCount: number;
  lastAccessed: Date;
}

export interface ContextTemplate {
  id: string;
  name: string;
  type: 'general_context' | 'code_context' | 'api_context' | 'example_context' | 'tutorial_context';
  template: string;
  variables: string[];
  metadata: {
    description: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
  };
}

export interface VectorSearchRequest {
  embedding: number[];
  limit: number;
  filters: {
    libraries?: string[];
    languages?: string[];
    types?: ContextSource['type'][];
    minRelevance?: number;
  };
}

export interface VectorSearchResult {
  id: string;
  sourceId: string;
  content: string;
  score: number;
  position: {
    start: number;
    end: number;
    index: number;
    total: number;
  };
  metadata: {
    sectionTitle?: string;
    codeBlocks: number;
    links: number;
    images: number;
    complexity: 'low' | 'medium' | 'high';
  };
  embeddings?: number[];
}

export interface NLPAnalysis {
  intent: {
    type: string;
    confidence: number;
    keywords: string[];
    category: string;
    subcategory?: string;
  };
  entities: Array<{
    text: string;
    type: string;
    confidence: number;
    position: {
      start: number;
      end: number;
    };
  }>;
  sentiment?: {
    polarity: number;
    subjectivity: number;
  };
  language: string;
}

export interface ContextProcessingMetrics {
  queryId: string;
  timestamp: Date;
  processingTime: number;
  vectorSearchTime: number;
  filteringTime: number;
  rankingTime: number;
  summaryGenerationTime: number;
  cacheHit: boolean;
  resultCount: number;
  averageRelevance: number;
}

export interface ContextError {
  queryId: string;
  error: string;
  code: string;
  timestamp: Date;
  context?: any;
  stack?: string;
}

export interface ContextConfig {
  maxResults: number;
  maxContextLength: number;
  cacheExpiration: number;
  diversityThreshold: number;
  relevanceThreshold: number;
  enableAnalytics: boolean;
  enableCache: boolean;
  defaultFilters: ContextFilters;
  defaultOptions: ContextOptions;
}
