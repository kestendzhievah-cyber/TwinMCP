import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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

export interface HttpServerConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
  apiKeyValidation: (apiKey: string) => Promise<ApiKeyValidationResult>;
  usageTracking: (data: UsageTrackingData) => Promise<void>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string | undefined;
  apiKeyId?: string | undefined;
  tier?: string | undefined;
  quotaDaily?: number | undefined;
  quotaMonthly?: number | undefined;
  usedDaily?: number | undefined;
  usedMonthly?: number | undefined;
  error?: string | undefined;
  errorCode?: string | undefined;
}

export interface UsageTrackingData {
  apiKeyId: string;
  userId: string;
  toolName: string;
  libraryId?: string | undefined;
  query?: string | undefined;
  tokensReturned?: number | undefined;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string | undefined;
}

interface AuthenticatedRequest extends Request {
  auth?: ApiKeyValidationResult | undefined;
  requestId?: string | undefined;
  startTime?: number | undefined;
}

export class TwinMCPHttpServer {
  private app: express.Application;
  private server: Server;
  private client: TwinMCPClient;
  private logger: MCPLogger;
  private handlers: Map<string, ToolHandler> = new Map();
  private config: HttpServerConfig;
  private httpServer?: ReturnType<typeof this.app.listen>;
  private transports: Map<string, SSEServerTransport> = new Map();

  constructor(config: HttpServerConfig, mcpConfig?: TwinMCPConfig) {
    this.config = config;
    this.logger = MCPLogger.create('TwinMCPHttpServer');
    this.client = new TwinMCPClient({
      ...mcpConfig,
      logger: this.logger,
    });

    this.app = express();
    this.server = new Server(
      {
        name: 'twinmcp-http-server',
        version: '1.0.0',
        description: 'TwinMCP HTTP Server with API Key Authentication',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMiddleware();
    this.setupHandlers();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(cors({
      origin: this.config.corsOrigins ?? '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    }));

    this.app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      req.requestId = this.generateRequestId();
      req.startTime = Date.now();
      next();
    });
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
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = this.handlers.get(name);
      
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const context: MCPContext = {
        requestId: this.generateRequestId(),
        config: {},
        logger: this.logger,
      };

      const result = await handler.handler(args, context);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    });
  }

  private setupRoutes(): void {
    // Health check (public)
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // API info (public)
    this.app.get('/api/info', (_req: Request, res: Response) => {
      res.json({
        name: 'TwinMCP Server',
        version: '1.0.0',
        description: 'MCP Server for documentation and code snippets',
        endpoints: {
          health: 'GET /health',
          info: 'GET /api/info',
          tools: 'GET /api/mcp/tools',
          call: 'POST /api/mcp/call',
          sse: 'GET /api/mcp/sse',
          usage: 'GET /api/usage',
        },
        authentication: {
          type: 'API Key',
          header: 'X-API-Key or Authorization: Bearer <key>',
        },
      });
    });

    // Protected routes - require API key
    this.app.use('/api/mcp', this.authMiddleware.bind(this));
    this.app.use('/api/usage', this.authMiddleware.bind(this));

    // List available tools
    this.app.get('/api/mcp/tools', async (req: AuthenticatedRequest, res: Response) => {
      try {
        const tools: Tool[] = Array.from(this.handlers.values()).map(handler => ({
          name: handler.name,
          description: handler.description,
          inputSchema: handler.inputSchema,
        }));

        res.json({
          success: true,
          tools,
          count: tools.length,
        });
      } catch (error) {
        this.handleError(res, error, req.requestId);
      }
    });

    // Call a tool
    this.app.post('/api/mcp/call', async (req: AuthenticatedRequest, res: Response) => {
      const startTime = req.startTime ?? Date.now();
      const { tool, arguments: args } = req.body;

      if (!tool || typeof tool !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid tool name',
          code: 'INVALID_REQUEST',
        });
        return;
      }

      const handler = this.handlers.get(tool);
      if (!handler) {
        res.status(404).json({
          success: false,
          error: `Tool not found: ${tool}`,
          code: 'TOOL_NOT_FOUND',
          availableTools: Array.from(this.handlers.keys()),
        });
        return;
      }

      try {
        const context: MCPContext = {
          requestId: req.requestId ?? this.generateRequestId(),
          config: {},
          logger: this.logger,
          ...(req.auth?.userId && { userId: req.auth.userId }),
          ...(req.auth?.apiKeyId && { apiKey: req.auth.apiKeyId }),
        };

        this.logger.info('Tool call started', {
          tool,
          requestId: context.requestId,
          userId: req.auth?.userId,
          apiKeyId: req.auth?.apiKeyId,
        });

        const result = await handler.handler(args ?? {}, context);
        const responseTimeMs = Date.now() - startTime;

        // Track usage
        if (req.auth?.apiKeyId && req.auth?.userId) {
          await this.config.usageTracking({
            apiKeyId: req.auth.apiKeyId,
            userId: req.auth.userId,
            toolName: tool,
            libraryId: args?.libraryId,
            query: args?.query,
            tokensReturned: this.estimateTokens(result),
            responseTimeMs,
            success: true,
          }).catch(err => this.logger.error('Usage tracking failed', err));
        }

        this.logger.info('Tool call completed', {
          tool,
          requestId: context.requestId,
          responseTimeMs,
        });

        res.json({
          success: true,
          result,
          meta: {
            requestId: context.requestId,
            tool,
            responseTimeMs,
            timestamp: new Date().toISOString(),
          },
        });

      } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Track failed usage
        if (req.auth?.apiKeyId && req.auth?.userId) {
          await this.config.usageTracking({
            apiKeyId: req.auth.apiKeyId,
            userId: req.auth.userId,
            toolName: tool,
            responseTimeMs,
            success: false,
            errorMessage,
          }).catch(err => this.logger.error('Usage tracking failed', err));
        }

        this.handleError(res, error, req.requestId);
      }
    });

    // SSE endpoint for MCP protocol
    this.app.get('/api/mcp/sse', async (req: AuthenticatedRequest, res: Response) => {
      const sessionId = req.requestId ?? this.generateRequestId();
      
      this.logger.info('SSE connection started', { sessionId, userId: req.auth?.userId });

      const transport = new SSEServerTransport('/api/mcp/messages', res);
      this.transports.set(sessionId, transport);

      res.on('close', () => {
        this.transports.delete(sessionId);
        this.logger.info('SSE connection closed', { sessionId });
      });

      await this.server.connect(transport);
    });

    // SSE messages endpoint
    this.app.post('/api/mcp/messages', async (req: AuthenticatedRequest, res: Response) => {
      const sessionId = req.query['sessionId'] as string;
      const transport = this.transports.get(sessionId);

      if (!transport) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
        return;
      }

      try {
        // Cast to the expected type for handlePostMessage
        await transport.handlePostMessage(req as Request, res);
      } catch (error) {
        this.handleError(res, error, req.requestId);
      }
    });

    // Get usage statistics
    this.app.get('/api/usage', async (req: AuthenticatedRequest, res: Response) => {
      try {
        res.json({
          success: true,
          usage: {
            apiKeyId: req.auth?.apiKeyId,
            tier: req.auth?.tier,
            quotaDaily: req.auth?.quotaDaily,
            quotaMonthly: req.auth?.quotaMonthly,
            usedDaily: req.auth?.usedDaily ?? 0,
            usedMonthly: req.auth?.usedMonthly ?? 0,
            remainingDaily: (req.auth?.quotaDaily ?? 0) - (req.auth?.usedDaily ?? 0),
            remainingMonthly: (req.auth?.quotaMonthly ?? 0) - (req.auth?.usedMonthly ?? 0),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.handleError(res, error, req.requestId);
      }
    });
  }

  private async authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const apiKey = this.extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY',
        hint: 'Provide API key via X-API-Key header or Authorization: Bearer <key>',
      });
      return;
    }

    try {
      const validation = await this.config.apiKeyValidation(apiKey);

      if (!validation.valid) {
        this.logger.warn('Invalid API key attempt', {
          error: validation.error,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        res.status(401).json({
          success: false,
          error: validation.error ?? 'Invalid API key',
          code: validation.errorCode ?? 'INVALID_API_KEY',
        });
        return;
      }

      req.auth = validation;
      next();

    } catch (error) {
      this.logger.error('Auth middleware error', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
      });
    }
  }

  private extractApiKey(req: Request): string | null {
    const headerKey = req.headers['x-api-key'] as string;
    if (headerKey) return headerKey;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const queryKey = req.query['api_key'] as string;
    if (queryKey) return queryKey;

    return null;
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      this.logger.error('Unhandled error', err, { requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: req.requestId,
      });
    });

    this.server.onerror = (error) => {
      this.logger.error('MCP Server error', error);
    };
  }

  private handleError(res: Response, error: unknown, requestId?: string | undefined): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Request error', error, { requestId });

    res.status(500).json({
      success: false,
      error: message,
      code: 'INTERNAL_ERROR',
      requestId,
    });
  }

  private generateRequestId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokens(data: unknown): number {
    try {
      const str = JSON.stringify(data);
      return Math.ceil(str.length / 4);
    } catch {
      return 0;
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`TwinMCP HTTP Server started on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((err: Error | undefined) => {
          if (err) reject(err);
          else {
            this.logger.info('TwinMCP HTTP Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  addHandler(handler: ToolHandler): void {
    this.handlers.set(handler.name, handler);
    this.logger.info('Added custom handler', { name: handler.name });
  }

  getApp(): express.Application {
    return this.app;
  }
}
