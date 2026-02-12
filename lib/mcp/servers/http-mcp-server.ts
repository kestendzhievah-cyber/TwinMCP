import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCPMessage, MCPErrorCodes, MCPMethods, MCPInitializeResponse, MCPServerTool, HttpServerConfig } from '../types';

export class HttpMCPServer {
  private tools: Map<string, MCPServerTool> = new Map();
  private server: FastifyInstance;
  private config: HttpServerConfig;
  private isInitialized: boolean = false;

  constructor(config: HttpServerConfig & { tools: MCPServerTool[] }) {
    this.config = config;
    this.server = Fastify({
      logger: config.logging,
      trustProxy: true
    });
    
    // Enregistrer les outils
    config.tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Custom JSON parser to handle invalid JSON gracefully (return JSON-RPC parse error)
    this.server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      try {
        const parsed = JSON.parse(body as string);
        done(null, parsed);
      } catch (err) {
        // Mark the error so the route can detect it
        done(null, { __parseError: true });
      }
    });

    // CORS
    if (this.config.cors) {
      this.server.register(import('@fastify/cors'), {
        origin: true,
        credentials: true
      });
    }
    
    // Rate limiting (simple in-memory, no @fastify/rate-limit dependency)
    if (this.config.rateLimit) {
      const ipHits = new Map<string, { count: number; reset: number }>();
      const maxReq = 100;
      const windowMs = 60_000;
      this.server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const ip = request.ip;
        const now = Date.now();
        let entry = ipHits.get(ip);
        if (!entry || entry.reset < now) {
          entry = { count: 0, reset: now + windowMs };
          ipHits.set(ip, entry);
        }
        entry.count++;
        reply.header('X-RateLimit-Limit', maxReq);
        reply.header('X-RateLimit-Remaining', Math.max(0, maxReq - entry.count));
        if (entry.count > maxReq) {
          reply.code(429).send({ error: 'Too Many Requests' });
        }
      });
    }
    
    // Request logging
    this.server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.info({
        method: request.method,
        url: request.url,
        headers: request.headers
      });
    });

    // Error handling
    this.server.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      this.server.log.error(error);
      
      const errorResponse: MCPMessage = {
        jsonrpc: '2.0' as const,
        id: undefined,
        error: {
          code: MCPErrorCodes.InternalError,
          message: 'Internal server error',
          data: error.message
        }
      };
      
      reply.status(500).send(errorResponse);
    });
  }

  private setupRoutes(): void {
    // Endpoint principal MCP
    this.server.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Handle JSON parse errors from custom content type parser
        if ((request.body as any)?.__parseError) {
          return reply.send({
            jsonrpc: '2.0' as const,
            id: null,
            error: {
              code: MCPErrorCodes.ParseError,
              message: 'Parse error'
            }
          });
        }

        const message: MCPMessage = request.body as MCPMessage;
        const response = await this.processMessage(message);
        return reply.send(response);
      } catch (error) {
        this.server.log.error(error);
        const errorResponse: MCPMessage = {
          jsonrpc: '2.0' as const,
          id: undefined,
          error: {
            code: MCPErrorCodes.InternalError,
            message: 'Internal server error'
          }
        };
        return reply.status(500).send(errorResponse);
      }
    });
    
    // Endpoint OAuth (pour Epic 3)
    this.server.post('/mcp/oauth', async (request: FastifyRequest, reply: FastifyReply) => {
      // Sera implémenté dans Epic 3
      const errorResponse: MCPMessage = {
        jsonrpc: '2.0' as const,
        id: undefined,
        error: {
          code: MCPErrorCodes.MethodNotFound,
          message: 'OAuth endpoint not implemented yet'
        }
      };
      reply.status(501).send(errorResponse);
    });
    
    // Health check
    this.server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        tools_count: this.tools.size,
        mode: 'http',
        initialized: this.isInitialized
      };
    });
    
    // Documentation
    this.server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        name: 'TwinMCP Server',
        version: '1.0.0',
        description: 'MCP server for documentation queries',
        mode: 'http',
        endpoints: {
          mcp: 'POST /mcp',
          health: 'GET /health',
          oauth: 'POST /mcp/oauth',
          docs: 'GET /'
        },
        tools: Array.from(this.tools.keys()).map(name => ({
          name,
          description: this.tools.get(name)?.description
        }))
      };
    });

    // Metrics endpoint
    this.server.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        tools: {
          total: this.tools.size,
          available: Array.from(this.tools.keys())
        },
        connections: {
          active: 0 // this.server.server.connections n'existe pas dans Fastify 4
        }
      };
    });
  }

  private async processMessage(message: MCPMessage): Promise<MCPMessage> {
    try {
      // Valider le format JSON-RPC
      if (message.jsonrpc !== '2.0') {
        return {
          jsonrpc: '2.0' as const,
          id: message.id,
          error: {
            code: MCPErrorCodes.InvalidRequest,
            message: 'Invalid JSON-RPC version'
          }
        };
      }

      // Router vers le bon gestionnaire
      if (message.method === MCPMethods.Initialize) {
        return this.handleInitialize(message);
      } else if (!this.isInitialized) {
        return {
          jsonrpc: '2.0' as const,
          id: message.id,
          error: {
            code: MCPErrorCodes.InvalidRequest,
            message: 'Server not initialized'
          }
        };
      } else if (message.method === MCPMethods.ToolsList) {
        return this.handleListTools(message);
      } else if (message.method === MCPMethods.ToolsCall) {
        return await this.handleToolCall(message);
      } else {
        return {
          jsonrpc: '2.0' as const,
          id: message.id,
          error: {
            code: MCPErrorCodes.MethodNotFound,
            message: `Method not found: ${message.method}`
          }
        };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0' as const,
        id: message.id,
        error: {
          code: MCPErrorCodes.InternalError,
          message: 'Internal server error',
          data: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
        }
      };
    }
  }

  private handleInitialize(message: MCPMessage): MCPMessage {
    if (this.isInitialized) {
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        error: {
          code: MCPErrorCodes.InvalidRequest,
          message: 'Server already initialized'
        }
      };
    }

    this.isInitialized = true;

    const response: MCPInitializeResponse = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        logging: {}
      },
      serverInfo: {
        name: 'twinmcp-server',
        version: '1.0.0'
      }
    };
    
    return {
      jsonrpc: '2.0' as const,
      id: message.id!,
      result: response
    };
  }

  private handleListTools(message: MCPMessage): MCPMessage {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return {
      jsonrpc: '2.0' as const,
      id: message.id!,
      result: { tools }
    };
  }

  private async handleToolCall(message: MCPMessage): Promise<MCPMessage> {
    if (!message.params || typeof message.params !== 'object') {
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        error: {
          code: MCPErrorCodes.InvalidParams,
          message: 'Invalid tool call parameters'
        }
      };
    }

    const { name, arguments: args } = message.params;
    
    if (!name || typeof name !== 'string') {
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        error: {
          code: MCPErrorCodes.InvalidParams,
          message: 'Tool name is required'
        }
      };
    }
    
    if (!this.tools.has(name)) {
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        error: {
          code: MCPErrorCodes.ToolNotFound,
          message: 'Tool not found',
          data: name
        }
      };
    }
    
    try {
      const tool = this.tools.get(name)!;
      const result = await tool.run(args || {});
      
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0' as const,
        id: message.id!,
        error: {
          code: MCPErrorCodes.ToolExecutionError,
          message: 'Tool execution error',
          data: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
        }
      };
    }
  }

  async start(): Promise<void> {
    try {
      await this.server.listen({
        port: this.config.port,
        host: this.config.host
      });
      
      this.server.log.info(`TwinMCP Server started in HTTP mode on ${this.config.host}:${this.config.port}`);
      this.server.log.info(`Registered tools: ${Array.from(this.tools.keys()).join(', ')}`);
    } catch (error) {
      this.server.log.error(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
      this.server.log.info('TwinMCP Server stopped');
    } catch (error) {
      this.server.log.error({ msg: 'Error during shutdown', error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error) });
      throw error;
    }
  }

  // Méthode pour ajouter des outils dynamiquement
  addTool(tool: MCPServerTool): void {
    this.tools.set(tool.name, tool);
    this.server.log.info(`Added tool: ${tool.name}`);
  }

  // Méthode pour supprimer des outils
  removeTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.server.log.info(`Removed tool: ${name}`);
    }
    return removed;
  }

  // Méthode pour lister les outils disponibles
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // Méthode pour vérifier si le serveur est initialisé
  isServerInitialized(): boolean {
    return this.isInitialized;
  }

  // Méthode pour obtenir l'instance Fastify (pour les tests)
  getServerInstance(): FastifyInstance {
    return this.server;
  }
}
