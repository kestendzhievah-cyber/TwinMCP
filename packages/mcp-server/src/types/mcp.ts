import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface TwinMCPConfig {
  serverUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface LibraryInfo {
  id: string;
  name: string;
  vendor?: string;
  repoUrl?: string;
  docsUrl?: string;
  defaultVersion?: string;
  popularityScore?: number;
  totalSnippets?: number;
  totalTokens?: number;
  lastCrawledAt?: string;
  metadata?: Record<string, any>;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    libraryId: string;
    version: string;
    contentType: 'snippet' | 'guide' | 'api_ref';
    sourceUrl: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    tokenCount: number;
  };
  score?: number;
}

export interface ResolveLibraryParams {
  query: string;
  libraryName?: string;
  version?: string;
}

export interface ResolveLibraryResult {
  libraryId: string;
  name: string;
  vendor?: string;
  repoUrl?: string;
  docsUrl?: string;
  defaultVersion?: string;
  confidence: number;
  alternatives?: LibraryInfo[];
}

export interface QueryDocsParams {
  libraryId: string;
  query: string;
  version?: string;
  contentType?: 'snippet' | 'guide' | 'api_ref';
  maxResults?: number;
  maxTokens?: number;
}

export interface QueryDocsResult {
  content: string;
  snippets: DocumentChunk[];
  totalResults: number;
  totalTokens: number;
  libraryId: string;
  version: string;
  query: string;
}

export interface ToolHandler<TParams = any, TResult = any> {
  name: string;
  description: string;
  inputSchema: any;
  handler: (params: TParams, context: MCPContext) => Promise<TResult>;
}

export interface MCPContext {
  requestId: string;
  userId?: string;
  apiKey?: string;
  config: TwinMCPConfig;
  logger: Logger;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: any, meta?: any): void;
}
