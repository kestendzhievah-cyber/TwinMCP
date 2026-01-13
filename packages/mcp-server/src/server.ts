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
