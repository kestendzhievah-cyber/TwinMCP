export interface DocumentIndexer {
  id: string;
  name: string;
  supportedFormats: string[];
  priority: number;
  config: IndexerConfig;
}

export interface IndexerConfig {
  maxChunkSize: number;
  overlapSize: number;
  minChunkSize: number;
  preserveStructure: boolean;
  includeCodeBlocks: boolean;
  includeMetadata: boolean;
  chunkingStrategy: 'semantic' | 'fixed' | 'hierarchical' | 'mixed';
}

export interface ParsedDocument {
  id: string;
  libraryId: string;
  sourcePath: string;
  title: string;
  type: 'readme' | 'api' | 'guide' | 'example' | 'reference' | 'changelog' | 'license';
  format: 'markdown' | 'html' | 'json' | 'typescript' | 'javascript' | 'other';
  metadata: {
    language: string;
    encoding: string;
    size: number;
    lastModified: Date;
    sections: DocumentSection[];
    codeBlocks: CodeBlock[];
    links: DocumentLink[];
    toc?: TableOfContents;
  };
  content: string;
  rawContent: string;
  chunks: DocumentChunk[];
  createdAt: Date;
  processedAt: Date;
}

export interface DocumentSection {
  id: string;
  level: number; // 1-6 pour headers
  title: string;
  content: string;
  startPosition: number;
  endPosition: number;
  subsections: DocumentSection[];
  metadata: {
    wordCount: number;
    hasCode: boolean;
    hasLinks: boolean;
    estimatedReadingTime: number;
  };
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  explanation?: string;
  context: string;
  position: {
    start: number;
    end: number;
  };
  metadata: {
    lineCount: number;
    complexity: 'simple' | 'medium' | 'complex';
    imports: string[];
    exports: string[];
    functions: string[];
    classes: string[];
  };
}

export interface DocumentLink {
  id: string;
  url: string;
  text: string;
  type: 'internal' | 'external' | 'anchor';
  target?: string;
  position: {
    start: number;
    end: number;
  };
}

export interface TableOfContents {
  entries: TOCEntry[];
  maxDepth: number;
}

export interface TOCEntry {
  id: string;
  level: number;
  title: string;
  anchor: string;
  children: TOCEntry[];
  position: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  type: 'text' | 'code' | 'mixed' | 'metadata';
  position: {
    start: number;
    end: number;
    index: number;
    total: number;
  };
  metadata: {
    wordCount: number;
    sectionTitle?: string;
    sectionLevel?: number;
    hasCode: boolean;
    hasLinks: boolean;
    language?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    tags: string[];
  };
  context: {
    previousChunk?: string;
    nextChunk?: string;
    sectionContext?: string;
    documentTitle: string;
    documentType: string;
  };
  embedding?: number[];
  embeddingModel?: string;
  createdAt: Date;
}

export interface IndexingTask {
  id: string;
  libraryId: string;
  sourcePath: string;
  status: 'pending' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'failed';
  progress: {
    phase: string;
    completed: number;
    total: number;
    percentage: number;
    currentFile: string;
  };
  config: IndexerConfig;
  results: {
    documentsParsed: number;
    chunksCreated: number;
    embeddingsGenerated: number;
    errors: string[];
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface IndexingStats {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  averageChunkSize: number;
  processingTime: number;
  errorRate: number;
  formatDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

export interface ParseOptions {
  filePath: string;
  libraryId: string;
  lastModified: Date;
  encoding?: string;
  language?: string;
}

export interface ChunkingOptions {
  maxChunkSize: number;
  overlapSize: number;
  minChunkSize: number;
  preserveStructure: boolean;
  includeCodeBlocks: boolean;
  includeMetadata: boolean;
}

export interface EmbeddingRequest {
  chunks: Array<{
    id: string;
    content: string;
    metadata: {
      url: string;
      title: string;
      contentType: string;
      position: number;
      totalChunks: number;
      lastModified: Date;
    };
  }>;
}

export interface EmbeddingResult {
  id: string;
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface ParserResult {
  title: string;
  type: ParsedDocument['type'];
  format: ParsedDocument['format'];
  metadata: ParsedDocument['metadata'];
  content: string;
  rawContent: string;
}
