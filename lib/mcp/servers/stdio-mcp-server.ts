import { Readable, Writable } from 'stream';
import { MCPMessage, MCPErrorCodes, MCPMethods, MCPInitializeResponse, MCPServerTool } from '../types';
import { logger } from '@/lib/logger';

export class StdioMCPServer {
  private tools: Map<string, MCPServerTool> = new Map();
  private input: Readable;
  private output: Writable;
  private buffer: string = '';
  private isInitialized: boolean = false;

  constructor(config: { tools: MCPServerTool[]; input?: Readable; output?: Writable }) {
    this.input = config.input || process.stdin;
    this.output = config.output || process.stdout;
    
    // Enregistrer les outils
    config.tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.input.setEncoding('utf8');
    this.input.on('data', (chunk: string) => {
      this.handleIncomingData(chunk);
    });
    
    this.input.on('error', (error) => {
      this.handleError('Input stream error', error);
    });
    
    this.output.on('error', (error) => {
      this.handleError('Output stream error', error);
    });

    // Gérer la terminaison proprement
    process.on('SIGINT', () => {
      this.gracefulShutdown();
    });

    process.on('SIGTERM', () => {
      this.gracefulShutdown();
    });
  }

  private handleIncomingData(chunk: string): void {
    this.buffer += chunk;
    
    // Traiter chaque message complet (séparé par \n)
    const messages = this.buffer.split('\n');
    this.buffer = messages.pop() || '';
    
    messages.forEach(message => {
      if (message.trim()) {
        this.processMessage(message);
      }
    });
  }

  private async processMessage(rawMessage: string): Promise<void> {
    try {
      const message: MCPMessage = JSON.parse(rawMessage);
      
      // Valider le format JSON-RPC
      if (message.jsonrpc !== '2.0') {
        this.sendError(message.id, MCPErrorCodes.InvalidRequest, 'Invalid JSON-RPC version');
        return;
      }

      // Router vers le bon gestionnaire
      if (message.method === MCPMethods.Initialize) {
        await this.handleInitialize(message);
      } else if (!this.isInitialized) {
        this.sendError(message.id, MCPErrorCodes.InvalidRequest, 'Server not initialized');
        return;
      } else if (message.method === MCPMethods.ToolsList) {
        await this.handleListTools(message);
      } else if (message.method === MCPMethods.ToolsCall) {
        await this.handleToolCall(message);
      } else {
        this.sendError(message.id, MCPErrorCodes.MethodNotFound, `Method not found: ${message.method}`);
      }
    } catch (error) {
      this.sendError(null, MCPErrorCodes.ParseError, 'Parse error', error instanceof Error ? error.message : String(error));
    }
  }

  private async handleInitialize(message: MCPMessage): Promise<void> {
    if (this.isInitialized) {
      this.sendError(message.id, MCPErrorCodes.InvalidRequest, 'Server already initialized');
      return;
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
    
    this.sendMessage({
      jsonrpc: '2.0' as const,
      id: message.id!,
      result: response
    });
  }

  private async handleListTools(message: MCPMessage): Promise<void> {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    const response: MCPMessage = {
      jsonrpc: '2.0' as const,
      id: message.id!,
      result: { tools }
    };
    
    this.sendMessage(response);
  }

  private async handleToolCall(message: MCPMessage): Promise<void> {
    if (!message.params || typeof message.params !== 'object') {
      this.sendError(message.id, MCPErrorCodes.InvalidParams, 'Invalid tool call parameters');
      return;
    }

    const { name, arguments: args } = message.params;
    
    if (!name || typeof name !== 'string') {
      this.sendError(message.id, MCPErrorCodes.InvalidParams, 'Tool name is required');
      return;
    }
    
    if (!this.tools.has(name)) {
      this.sendError(message.id, MCPErrorCodes.ToolNotFound, 'Tool not found', name);
      return;
    }
    
    try {
      const tool = this.tools.get(name)!;
      const result = await tool.run(args || {});
      
      const response: MCPMessage = {
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
      
      this.sendMessage(response);
    } catch (error) {
      this.sendError(
        message.id, 
        MCPErrorCodes.ToolExecutionError, 
        'Tool execution error', 
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private sendMessage(message: MCPMessage): void {
    try {
      const jsonMessage = JSON.stringify(message) + '\n';
      this.output.write(jsonMessage);
    } catch (error) {
      this.handleError('Failed to send message', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private sendError(id: any, code: number, message: string, data?: any): void {
    const errorResponse: MCPMessage = {
      jsonrpc: '2.0' as const,
      id,
      error: { code, message, data }
    };
    
    this.sendMessage(errorResponse);
  }

  private handleError(context: string, error: Error): void {
    logger.error(`[${context}] ${error.message}`);
  }

  private gracefulShutdown(): void {
    logger.info('TwinMCP Server shutting down gracefully...');
    this.stop().then(() => {
      process.exit(0);
    }).catch((error) => {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    logger.info('TwinMCP Server started in stdio mode');
    logger.info(`Registered tools: ${Array.from(this.tools.keys()).join(', ')}`);
    // Le serveur est maintenant à l'écoute sur stdin/stdout
  }

  async stop(): Promise<void> {
    try {
      this.input.destroy();
      this.output.destroy();
      logger.info('TwinMCP Server stopped');
    } catch (error) {
      this.handleError('Error during shutdown', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Méthode pour ajouter des outils dynamiquement
  addTool(tool: MCPServerTool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`Added tool: ${tool.name}`);
  }

  // Méthode pour supprimer des outils
  removeTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      logger.debug(`Removed tool: ${name}`);
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
}
