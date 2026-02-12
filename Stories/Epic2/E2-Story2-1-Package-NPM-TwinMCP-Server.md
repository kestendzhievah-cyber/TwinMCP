# Story 2.1: Package NPM TwinMCP Server

**Epic**: 2 - Serveur MCP Core  
**Story**: 2.1: Package NPM TwinMCP Server  
**Estimation**: 3-4 jours  
**Priorité**: Critique  

---

## Objectif

Créer le package NPM @twinmcp/mcp avec le SDK MCP officiel, structure modulaire, interfaces TypeScript, et foundation pour les outils resolve-library-id et query-docs.

---

## Prérequis

- Epic 1 complétée (infrastructure de base)
- Compte NPM (pour publication)
- Connaissance du protocole MCP

---

## Étapes Détaillées

### Étape 1: Initialisation du package NPM

**Action**: Créer la structure du package @twinmcp/mcp

```bash
# Créer le dossier du package
mkdir -p packages/mcp-server
cd packages/mcp-server

# Initialiser package.json pour le package
npm init -y

# Installer les dépendances MCP
npm install @modelcontextprotocol/sdk
npm install --save-dev typescript @types/node

# Installer les dépendances de notre projet
npm install @twinmcp/core
```

**package.json du package MCP**:
```json
{
  "name": "@twinmcp/mcp",
  "version": "1.0.0",
  "description": "TwinMCP MCP Server - Documentation and code snippets for any library",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "twinmcp-server": "dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "cli": "ts-node src/cli.ts",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "documentation",
    "code-snippets",
    "llm",
    "ai"
  ],
  "author": "TwinMCP Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/twinmcp/twinmcp.git",
    "directory": "packages/mcp-server"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "@twinmcp/core": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### Étape 2: Interfaces et types MCP

**Action**: Définir les interfaces TypeScript pour les outils MCP

**src/types/mcp.ts**:
```typescript
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
```

### Étape 3: Service de logging

**Action**: Créer un service de logging adapté au package MCP

**src/utils/logger.ts**:
```typescript
import { Logger } from '../types/mcp';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class MCPLogger implements Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = 'TwinMCP', level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.error(this.formatMessage('DEBUG', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  error(message: string, error?: any, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMeta = error ? { error: error.message || error, stack: error.stack, ...meta } : meta;
      console.error(this.formatMessage('ERROR', message, errorMeta));
    }
  }

  static create(context: string, level: LogLevel = LogLevel.INFO): MCPLogger {
    return new MCPLogger(context, level);
  }
}

export const defaultLogger = new MCPLogger();
```

### Étape 4: Service client TwinMCP

**Action**: Créer le client pour communiquer avec le backend TwinMCP

**src/client/twinmcp-client.ts**:
```typescript
import { TwinMCPConfig, LibraryInfo, DocumentChunk, ResolveLibraryParams, ResolveLibraryResult, QueryDocsParams, QueryDocsResult, MCPContext } from '../types/mcp';
import { MCPLogger } from '../utils/logger';

export interface TwinMCPClientOptions extends TwinMCPConfig {
  timeout?: number;
  retries?: number;
  logger?: MCPLogger;
}

export class TwinMCPClient {
  private config: Required<TwinMCPConfig>;
  private logger: MCPLogger;

  constructor(options: TwinMCPClientOptions = {}) {
    this.config = {
      serverUrl: options.serverUrl || process.env.TWINMCP_SERVER_URL || 'http://localhost:3000',
      apiKey: options.apiKey || process.env.TWINMCP_API_KEY,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
    };

    this.logger = options.logger || MCPLogger.create('TwinMCPClient');

    if (!this.config.apiKey) {
      this.logger.warn('No API key provided, some features may be limited');
    }
  }

  async resolveLibrary(params: ResolveLibraryParams): Promise<ResolveLibraryResult> {
    return this.makeRequest<ResolveLibraryResult>('/api/resolve-library', params);
  }

  async queryDocs(params: QueryDocsParams): Promise<QueryDocsResult> {
    return this.makeRequest<QueryDocsResult>('/api/query-docs', params);
  }

  private async makeRequest<T>(endpoint: string, data?: any): Promise<T> {
    const url = `${this.config.serverUrl}${endpoint}`;
    const requestId = this.generateRequestId();

    this.logger.debug('Making request', { requestId, endpoint, hasData: !!data });

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: data ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        this.logger.debug('Request successful', { requestId, attempt });
        return result;

      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Request attempt ${attempt} failed`, { requestId, error: lastError.message });

        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error('Request failed after all retries', lastError, { requestId });
    throw lastError!;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/api/health');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
```

### Étape 5: Handlers d'outils MCP

**Action**: Créer les handlers pour les outils MCP

**src/handlers/resolve-library.handler.ts**:
```typescript
import { ToolHandler, ResolveLibraryParams, ResolveLibraryResult, MCPContext } from '../types/mcp';
import { TwinMCPClient } from '../client/twinmcp-client';

export class ResolveLibraryHandler implements ToolHandler<ResolveLibraryParams, ResolveLibraryResult> {
  name = 'resolve-library-id';
  description = 'Resolve a library name or query to a canonical library identifier';
  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query describing the library or functionality needed',
        minLength: 1,
        maxLength: 500,
      },
      libraryName: {
        type: 'string',
        description: 'Optional specific library name to search for',
        minLength: 1,
        maxLength: 100,
      },
      version: {
        type: 'string',
        description: 'Optional specific version of the library',
        pattern: '^\\d+\\.\\d+(\\.\\d+)?(-[a-zA-Z0-9]+)?$',
      },
    },
    required: ['query'],
  };

  constructor(private client: TwinMCPClient) {}

  async handler(params: ResolveLibraryParams, context: MCPContext): Promise<ResolveLibraryResult> {
    context.logger.info('Resolving library', { query: params.query, libraryName: params.libraryName });

    try {
      const result = await this.client.resolveLibrary(params);
      
      context.logger.info('Library resolved successfully', {
        libraryId: result.libraryId,
        confidence: result.confidence,
        requestId: context.requestId,
      });

      return result;
    } catch (error) {
      context.logger.error('Failed to resolve library', error, { params });
      throw error;
    }
  }
}
```

**src/handlers/query-docs.handler.ts**:
```typescript
import { ToolHandler, QueryDocsParams, QueryDocsResult, MCPContext } from '../types/mcp';
import { TwinMCPClient } from '../client/twinmcp-client';

export class QueryDocsHandler implements ToolHandler<QueryDocsParams, QueryDocsResult> {
  name = 'query-docs';
  description = 'Search documentation for a specific library using natural language queries';
  inputSchema = {
    type: 'object',
    properties: {
      libraryId: {
        type: 'string',
        description: 'The canonical library identifier (e.g., /mongodb/docs)',
        minLength: 3,
        maxLength: 200,
      },
      query: {
        type: 'string',
        description: 'Natural language query for searching documentation',
        minLength: 1,
        maxLength: 500,
      },
      version: {
        type: 'string',
        description: 'Optional specific version of the library',
        pattern: '^\\d+\\.\\d+(\\.\\d+)?(-[a-zA-Z0-9]+)?$',
      },
      contentType: {
        type: 'string',
        description: 'Filter results by content type',
        enum: ['snippet', 'guide', 'api_ref'],
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum total tokens in response',
        minimum: 100,
        maximum: 8000,
        default: 4000,
      },
    },
    required: ['libraryId', 'query'],
  };

  constructor(private client: TwinMCPClient) {}

  async handler(params: QueryDocsParams, context: MCPContext): Promise<QueryDocsResult> {
    context.logger.info('Querying documentation', {
      libraryId: params.libraryId,
      query: params.query,
      version: params.version,
    });

    try {
      const result = await this.client.queryDocs(params);
      
      context.logger.info('Documentation query successful', {
        libraryId: result.libraryId,
        totalResults: result.totalResults,
        totalTokens: result.totalTokens,
        requestId: context.requestId,
      });

      return result;
    } catch (error) {
      context.logger.error('Failed to query documentation', error, { params });
      throw error;
    }
  }
}
```

### Étape 6: Serveur MCP principal

**Action**: Créer le serveur MCP avec tous les outils

**src/server.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { TwinMCPConfig, MCPContext, ToolHandler } from './types/mcp';
import { MCPLogger } from './utils/logger';
import { TwinMCPClient } from './client/twinmcp-client';
import { ResolveLibraryHandler } from './handlers/resolve-library.handler';
import { QueryDocsHandler } from './handlers/query-docs.handler';

export interface TwinMCPServerOptions {
  config?: TwinMCPConfig;
  logger?: MCPLogger;
}

export class TwinMCPServer {
  private server: Server;
  private client: TwinMCPClient;
  private logger: MCPLogger;
  private handlers: Map<string, ToolHandler> = new Map();

  constructor(options: TwinMCPServerOptions = {}) {
    this.logger = options.logger || MCPLogger.create('TwinMCPServer');
    this.client = new TwinMCPClient({
      ...options.config,
      logger: this.logger,
    });

    this.server = new Server(
      {
        name: 'twinmcp-server',
        version: '1.0.0',
        description: 'TwinMCP Server - Documentation and code snippets for any library',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    const resolveHandler = new ResolveLibraryHandler(this.client);
    const queryHandler = new QueryDocsHandler(this.client);

    this.handlers.set(resolveHandler.name, resolveHandler);
    this.handlers.set(queryHandler.name, queryHandler);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = Array.from(this.handlers.values()).map(handler => ({
        name: handler.name,
        description: handler.description,
        inputSchema: handler.inputSchema,
      }));

      this.logger.debug('Listed tools', { count: tools.length });
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = this.generateRequestId();

      this.logger.info('Tool call received', { name, requestId });

      const handler = this.handlers.get(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const context: MCPContext = {
          requestId,
          config: {},
          logger: this.logger,
        };

        const result = await handler.handler(args, context);

        this.logger.info('Tool call successful', { name, requestId });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error('Tool call failed', error, { name, requestId });
        throw error;
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.logger.error('MCP Server error', error);
    };

    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, shutting down gracefully');
      await this.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, shutting down gracefully');
      await this.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    this.logger.info('Starting TwinMCP Server...');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('TwinMCP Server started successfully');
  }

  async close(): Promise<void> {
    this.logger.info('Closing TwinMCP Server...');
    await this.server.close();
    this.logger.info('TwinMCP Server closed');
  }

  private generateRequestId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addHandler(handler: ToolHandler): void {
    this.handlers.set(handler.name, handler);
    this.logger.info('Added custom handler', { name: handler.name });
  }

  getClient(): TwinMCPClient {
    return this.client;
  }
}
```

### Étape 7: CLI et point d'entrée

**Action**: Créer l'interface CLI et les points d'entrée

**src/cli.ts**:
```typescript
#!/usr/bin/env node

import { TwinMCPServer } from './server';
import { MCPLogger } from './utils/logger';

async function main() {
  const logger = MCPLogger.create('TwinMCP-CLI');

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'version':
      console.log('TwinMCP Server v1.0.0');
      process.exit(0);

    case 'help':
      console.log(`
TwinMCP Server - Documentation and code snippets for any library

Usage:
  twinmcp-server              Start the MCP server (stdio mode)
  twinmcp-server version      Show version
  twinmcp-server help         Show this help

Environment Variables:
  TWINMCP_SERVER_URL    Backend server URL (default: http://localhost:3000)
  TWINMCP_API_KEY       API key for authentication
  LOG_LEVEL            Logging level (debug, info, warn, error)
      `);
      process.exit(0);

    default:
      const server = new TwinMCPServer({
        logger,
      });

      try {
        await server.run();
      } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
      }
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

**src/index.ts**:
```typescript
export { TwinMCPServer } from './server';
export { TwinMCPClient } from './client/twinmcp-client';
export { ResolveLibraryHandler } from './handlers/resolve-library.handler';
export { QueryDocsHandler } from './handlers/query-docs.handler';
export { MCPLogger } from './utils/logger';

export type {
  TwinMCPConfig,
  LibraryInfo,
  DocumentChunk,
  ResolveLibraryParams,
  ResolveLibraryResult,
  QueryDocsParams,
  QueryDocsResult,
  ToolHandler,
  MCPContext,
  Logger,
} from './types/mcp';
```

### Étape 8: Tests du package MCP

**Action**: Créer les tests pour valider le fonctionnement

**src/test/server.test.ts**:
```typescript
import { TwinMCPServer } from '../server';
import { TwinMCPClient } from '../client/twinmcp-client';
import { MCPLogger } from '../utils/logger';

class MockTwinMCPClient extends TwinMCPClient {
  async resolveLibrary(params: any) {
    return {
      libraryId: '/test/library',
      name: 'Test Library',
      confidence: 0.95,
    };
  }

  async queryDocs(params: any) {
    return {
      content: 'Test documentation content',
      snippets: [{
        id: 'chunk1',
        content: 'Test snippet',
        metadata: {
          libraryId: params.libraryId,
          version: params.version || '1.0.0',
          contentType: 'guide',
          sourceUrl: 'https://example.com',
          tokenCount: 100,
        },
        score: 0.9,
      }],
      totalResults: 1,
      totalTokens: 100,
      libraryId: params.libraryId,
      version: params.version || '1.0.0',
      query: params.query,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('TwinMCP Server', () => {
  let server: TwinMCPServer;
  let mockClient: MockTwinMCPClient;

  beforeEach(() => {
    mockClient = new MockTwinMCPClient();
    server = new TwinMCPServer({
      logger: MCPLogger.create('Test'),
    });

    (server as any).client = mockClient;
  });

  describe('Tool Registration', () => {
    it('should register resolve-library-id tool', () => {
      const handlers = (server as any).handlers;
      expect(handlers.has('resolve-library-id')).toBe(true);
    });

    it('should register query-docs tool', () => {
      const handlers = (server as any).handlers;
      expect(handlers.has('query-docs')).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute resolve-library-id tool', async () => {
      const handler = (server as any).handlers.get('resolve-library-id');
      const context = {
        requestId: 'test-123',
        config: {},
        logger: MCPLogger.create('Test'),
      };

      const result = await handler.handler(
        { query: 'test library' },
        context
      );

      expect(result.libraryId).toBe('/test/library');
      expect(result.name).toBe('Test Library');
      expect(result.confidence).toBe(0.95);
    });

    it('should execute query-docs tool', async () => {
      const handler = (server as any).handlers.get('query-docs');
      const context = {
        requestId: 'test-456',
        config: {},
        logger: MCPLogger.create('Test'),
      };

      const result = await handler.handler(
        {
          libraryId: '/test/library',
          query: 'how to use',
        },
        context
      );

      expect(result.content).toBe('Test documentation content');
      expect(result.snippets).toHaveLength(1);
      expect(result.libraryId).toBe('/test/library');
    });
  });
});
```

### Étape 9: Documentation et README

**README.md**:
```markdown
# @twinmcp/mcp

TwinMCP MCP Server - Documentation and code snippets for any library, powered by the Model Context Protocol.

## Installation

```bash
npm install @twinmcp/mcp
```

## Usage

### As MCP Server (stdio)

```bash
npx @twinmcp/mcp
```

### Programmatic Usage

```typescript
import { TwinMCPServer, TwinMCPClient } from '@twinmcp/mcp';

// Start MCP server
const server = new TwinMCPServer();
await server.run();

// Use client directly
const client = new TwinMCPClient({
  serverUrl: 'https://api.twinmcp.com',
  apiKey: 'your-api-key',
});

// Resolve a library
const library = await client.resolveLibrary({
  query: 'How do I set up MongoDB authentication?'
});

// Query documentation
const docs = await client.queryDocs({
  libraryId: '/mongodb/docs',
  query: 'connection pooling examples'
});
```

## Available Tools

### resolve-library-id

Resolve a library name or query to a canonical library identifier.

### query-docs

Search documentation for a specific library using natural language queries.

## License

MIT
```

---

## Critères d'Achèvement

- [ ] Package NPM @twinmcp/mcp créé et configurable
- [ ] Serveur MCP avec stdio transport fonctionnel
- [ ] Interfaces TypeScript complètes
- [ ] Handlers pour resolve-library-id et query-docs
- [ ] Client TwinMCP intégré
- [ ] CLI fonctionnelle
- [ ] Tests unitaires passants
- [ ] Documentation complète

---

## Tests de Validation

```bash
# 1. Builder le package
npm run build

# 2. Exécuter les tests
npm test

# 3. Tester la CLI
npm run cli -- help
npm run cli -- version

# 4. Linter
npm run lint
```

---

## Prochaine Étape

Passer à **Story 2.2: Implémentation de l'outil resolve-library-id** pour développer la logique complète de résolution des bibliothèques.
