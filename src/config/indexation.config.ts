import { DocumentIndexer, IndexerConfig } from '../types/indexation.types';

export const INDEXATION_CONFIG = {
  default: {
    maxChunkSize: 1000,
    overlapSize: 100,
    minChunkSize: 200,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'semantic' as const
  },
  markdown: {
    maxChunkSize: 1500,
    overlapSize: 150,
    minChunkSize: 300,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'hierarchical' as const
  },
  code: {
    maxChunkSize: 800,
    overlapSize: 50,
    minChunkSize: 100,
    preserveStructure: false,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'semantic' as const
  },
  api: {
    maxChunkSize: 600,
    overlapSize: 100,
    minChunkSize: 150,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'mixed' as const
  }
};

export const PARSER_REGISTRY: Record<string, DocumentIndexer> = {
  markdown: {
    id: 'markdown-parser',
    name: 'Markdown Parser',
    supportedFormats: ['.md', '.markdown'],
    priority: 1,
    config: INDEXATION_CONFIG.markdown
  },
  typescript: {
    id: 'typescript-parser',
    name: 'TypeScript Parser',
    supportedFormats: ['.ts', '.tsx'],
    priority: 2,
    config: INDEXATION_CONFIG.code
  },
  javascript: {
    id: 'javascript-parser',
    name: 'JavaScript Parser',
    supportedFormats: ['.js', '.jsx'],
    priority: 2,
    config: INDEXATION_CONFIG.code
  },
  html: {
    id: 'html-parser',
    name: 'HTML Parser',
    supportedFormats: ['.html', '.htm'],
    priority: 3,
    config: INDEXATION_CONFIG.default
  },
  json: {
    id: 'json-parser',
    name: 'JSON Parser',
    supportedFormats: ['.json'],
    priority: 4,
    config: INDEXATION_CONFIG.default
  }
};

export const INDEXATION_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxChunksPerDocument: 1000,
  maxEmbeddingBatchSize: 100,
  maxConcurrentTasks: 5,
  taskTimeout: 30 * 60 * 1000, // 30 minutes
  chunkingTimeout: 60 * 1000 // 1 minute per document
};

export const INDEXATION_METRICS = {
  performance: {
    targetParsingSpeed: 100, // documents per second
    targetChunkingEfficiency: 0.9, // 90% token utilization
    targetEmbeddingSpeed: 50, // chunks per second
    targetStoragePerformance: 100 // ms per chunk
  },
  quality: {
    minChunkSize: 50,
    maxChunkSize: 2000,
    minWordCount: 10,
    maxComplexityScore: 0.8
  }
};

export const INDEXATION_CACHE = {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 1000, // max cached documents
  keyPrefix: 'indexation:',
  chunkKeyPrefix: 'chunk:',
  documentKeyPrefix: 'doc:'
};
