import { VectorSearchResult } from './embeddings.types';

export interface ContextAssemblyRequest {
  query: string;
  queryEmbedding: number[];
  searchResults: VectorSearchResult[];
  targetModel: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'llama-2' | 'custom';
  maxTokens: number;
  options: {
    includeCodeExamples: boolean;
    includeApiReferences: boolean;
    prioritizeRecent: boolean;
    deduplicateContent: boolean;
    maintainStructure: boolean;
    addMetadata: boolean;
    compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
  };
  context?: {
    userLevel: 'beginner' | 'intermediate' | 'expert';
    projectType: string;
    framework?: string;
    language?: string;
  };
}

export interface ContextAssemblyResult {
  assembledContext: string;
  metadata: {
    totalChunks: number;
    includedChunks: number;
    excludedChunks: number;
    tokenCount: number;
    compressionRatio: number;
    processingTime: number;
  };
  structure: {
    sections: ContextSection[];
    codeBlocks: CodeBlock[];
    apiReferences: ApiReference[];
    examples: Example[];
  };
  sources: SourceReference[];
  quality: {
    relevanceScore: number;
    completenessScore: number;
    clarityScore: number;
    structureScore: number;
  };
}

export interface ContextSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'explanation' | 'code' | 'api' | 'example' | 'reference';
  priority: number;
  tokenCount: number;
  sourceReferences: string[];
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  explanation?: string;
  context: string;
  relevanceScore: number;
}

export interface ApiReference {
  id: string;
  method: string;
  signature: string;
  description: string;
  parameters: Parameter[];
  returns: string;
  example?: string;
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface Example {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  section?: string;
  relevanceScore: number;
  lastUpdated: Date;
}

export interface ContextTemplate {
  id: string;
  name: string;
  targetModel: string;
  maxTokens: number;
  sections: TemplateSection[];
  variables: TemplateVariable[];
}

export interface TemplateSection {
  id: string;
  name: string;
  type: 'static' | 'dynamic' | 'conditional';
  content: string;
  priority: number;
  maxTokens: number;
  conditions?: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'array';
  defaultValue: any;
  description: string;
}

export interface ContentCompressionOptions {
  targetRatio: number;
  preserveStructure: boolean;
  prioritizeImportant: boolean;
}

export interface QualityMetrics {
  relevanceScore: number;
  completenessScore: number;
  clarityScore: number;
  structureScore: number;
}

export interface AssemblyMetrics {
  totalChunks: number;
  includedChunks: number;
  excludedChunks: number;
  tokenCount: number;
  compressionRatio: number;
  processingTime: number;
}
