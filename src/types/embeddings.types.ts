export interface DocumentChunk {
  id: string;
  libraryId: string;
  content: string;
  metadata: {
    url: string;
    title: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    contentType: 'text' | 'code' | 'example' | 'api';
    position: number;
    totalChunks: number;
    version?: string;
    lastModified: Date;
  };
  embedding?: number[];
  embeddingModel: string;
  embeddingVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingRequest {
  chunks: Array<{
    id: string;
    content: string;
    metadata: DocumentChunk['metadata'];
  }>;
  model?: string;
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  model: string;
  tokens: number;
  cost: number;
  processingTime: number;
}

export interface EmbeddingStats {
  totalChunks: number;
  totalTokens: number;
  totalCost: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  modelUsage: Record<string, number>;
}

export interface VectorSearchQuery {
  query: string;
  libraryId?: string;
  filters?: {
    contentType?: DocumentChunk['metadata']['contentType'][];
    codeLanguage?: string[];
    version?: string;
    section?: string[];
  };
  limit: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface VectorSearchResult {
  chunk: DocumentChunk;
  score: number;
  relevance: 'high' | 'medium' | 'low';
  highlights?: string[];
}

export interface EmbeddingModelConfig {
  dimensions: number;
  maxTokens: number;
  costPer1KTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'good' | 'excellent' | 'standard';
}

export interface EmbeddingGenerationConfig {
  openaiApiKey: string;
  defaultModel: string;
  maxRetries: number;
  retryDelay: number;
  batchSize?: number;
  cacheTTL?: number;
}

export interface CacheStats {
  hitRate: number;
  errorRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface CostForecast {
  estimatedCost: number;
  estimatedTokens: number;
  recommendations: string[];
}

export interface EmbeddingAnalytics {
  totalChunks: number;
  totalTokens: number;
  totalCost: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  modelUsage: Record<string, number>;
  errorRate: number;
}

export interface BatchProcessingStats {
  model: string;
  chunksProcessed: number;
  totalTokens: number;
  totalCost: number;
  averageProcessingTime: number;
  timestamp: Date;
}
