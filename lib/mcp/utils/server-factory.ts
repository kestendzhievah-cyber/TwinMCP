import { StdioMCPServer } from '../servers/stdio-mcp-server';
import { HttpMCPServer } from '../servers/http-mcp-server';
import { MCPServerTool, MCPServerConfig, HttpServerConfig } from '../types';
import { MCPServerMetrics } from '../services/mcp-metrics.service';

export type MCPServerInstance = StdioMCPServer | HttpMCPServer | { stdio: StdioMCPServer; http: HttpMCPServer };

export class MCPServerFactory {
  private static metrics: MCPServerMetrics = new MCPServerMetrics();

  static create(config: MCPServerConfig): MCPServerInstance {
    // Valider la configuration
    this.validateConfig(config);

    // Créer les serveurs selon le mode
    switch (config.mode) {
      case 'stdio':
        return this.createStdioServer(config);
      
      case 'http':
        return this.createHttpServer(config);
      
      case 'both':
        return this.createBothServers(config);
      
      default:
        throw new Error(`Unknown server mode: ${config.mode}`);
    }
  }

  private static validateConfig(config: MCPServerConfig): void {
    if (!config.mode || !['stdio', 'http', 'both'].includes(config.mode)) {
      throw new Error('Invalid server mode. Must be "stdio", "http", or "both"');
    }

    if (!config.tools || !Array.isArray(config.tools) || config.tools.length === 0) {
      throw new Error('At least one tool must be provided');
    }

    // Valider chaque outil
    config.tools.forEach((tool, index) => {
      if (!tool.name || typeof tool.name !== 'string') {
        throw new Error(`Tool at index ${index} must have a valid name`);
      }
      if (!tool.description || typeof tool.description !== 'string') {
        throw new Error(`Tool "${tool.name}" must have a valid description`);
      }
      if (!tool.run || typeof tool.run !== 'function') {
        throw new Error(`Tool "${tool.name}" must have a valid run function`);
      }
    });

    // Valider la configuration HTTP si nécessaire
    if (config.mode === 'http' || config.mode === 'both') {
      if (!config.http) {
        throw new Error('HTTP configuration is required for HTTP mode');
      }
      this.validateHttpConfig(config.http);
    }

    // Valider la configuration stdio si nécessaire
    if (config.mode === 'stdio' || config.mode === 'both') {
      if (config.stdio) {
        this.validateStdioConfig(config.stdio);
      }
    }
  }

  private static validateHttpConfig(config: HttpServerConfig): void {
    if (!config.port || typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      throw new Error('HTTP port must be a valid port number (1-65535)');
    }
    if (!config.host || typeof config.host !== 'string') {
      throw new Error('HTTP host must be a valid string');
    }
    if (typeof config.cors !== 'boolean') {
      throw new Error('HTTP cors must be a boolean');
    }
    if (typeof config.rateLimit !== 'boolean') {
      throw new Error('HTTP rateLimit must be a boolean');
    }
  }

  private static validateStdioConfig(config: any): void {
    if (config.encoding && !['utf8', 'ascii', 'base64'].includes(config.encoding)) {
      throw new Error('Stdio encoding must be utf8, ascii, or base64');
    }
    if (config.delimiter && typeof config.delimiter !== 'string') {
      throw new Error('Stdio delimiter must be a string');
    }
  }

  private static createStdioServer(config: MCPServerConfig): StdioMCPServer {
    const server = new StdioMCPServer({ tools: config.tools });
    
    // Configurer le monitoring
    this.setupMetricsMonitoring(server, 'stdio');
    
    return server;
  }

  private static createHttpServer(config: MCPServerConfig): HttpMCPServer {
    if (!config.http) {
      throw new Error('HTTP configuration is required for HTTP mode');
    }

    const httpConfig: HttpServerConfig & { tools: MCPServerTool[] } = {
      ...config.http,
      tools: config.tools,
      logging: config.logging
    };

    const server = new HttpMCPServer(httpConfig);
    
    // Configurer le monitoring
    this.setupMetricsMonitoring(server, 'http');
    
    return server;
  }

  private static createBothServers(config: MCPServerConfig): { stdio: StdioMCPServer; http: HttpMCPServer } {
    if (!config.http) {
      throw new Error('HTTP configuration is required for both mode');
    }

    const stdioServer = this.createStdioServer(config);
    const httpServer = this.createHttpServer(config);

    return {
      stdio: stdioServer,
      http: httpServer
    };
  }

  private static setupMetricsMonitoring(_server: StdioMCPServer | HttpMCPServer, _mode: string): void {
    // Intercepter les appels pour collecter des métriques
    // Note: Ceci est une implémentation de base. Dans une vraie application,
    // vous voudriez peut-être utiliser des décorateurs ou des middlewares plus sophistiqués
    
    // Pour l'instant, nous allons simplement configurer les alertes
    this.metrics.setupAlerts({
      errorRate: 0.1, // 10%
      responseTime: 1000, // 1 seconde
      connections: 100
    });
  }

  // Méthodes utilitaires pour la gestion des serveurs
  static async startServer(server: MCPServerInstance): Promise<void> {
    if ('stdio' in server && 'http' in server) {
      // Mode both
      await Promise.all([
        server.stdio.start(),
        server.http.start()
      ]);
    } else if ('start' in server) {
      // Mode unique
      await server.start();
    } else {
      throw new Error('Invalid server instance');
    }
  }

  static async stopServer(server: MCPServerInstance): Promise<void> {
    if ('stdio' in server && 'http' in server) {
      // Mode both
      await Promise.all([
        server.stdio.stop(),
        server.http.stop()
      ]);
    } else if ('stop' in server) {
      // Mode unique
      await server.stop();
    } else {
      throw new Error('Invalid server instance');
    }
  }

  static getServerInfo(server: MCPServerInstance): any {
    if ('stdio' in server && 'http' in server) {
      // Mode both
      return {
        mode: 'both',
        stdio: {
          type: 'stdio',
          initialized: server.stdio.isServerInitialized(),
          tools: server.stdio.getAvailableTools()
        },
        http: {
          type: 'http',
          initialized: server.http.isServerInitialized(),
          tools: server.http.getAvailableTools()
        }
      };
    } else if (server instanceof StdioMCPServer) {
      // Mode stdio
      return {
        mode: 'stdio',
        type: 'stdio',
        initialized: server.isServerInitialized(),
        tools: server.getAvailableTools()
      };
    } else if (server instanceof HttpMCPServer) {
      // Mode http
      return {
        mode: 'http',
        type: 'http',
        initialized: server.isServerInitialized(),
        tools: server.getAvailableTools()
      };
    } else {
      throw new Error('Invalid server instance');
    }
  }

  static getMetrics(): MCPServerMetrics {
    return this.metrics;
  }

  static resetMetrics(): void {
    this.metrics.reset();
  }

  // Méthodes pour la création de configurations par défaut
  static createDefaultConfig(mode: 'stdio' | 'http' | 'both', tools: MCPServerTool[]): MCPServerConfig {
    const baseConfig: Omit<MCPServerConfig, 'mode' | 'stdio' | 'http'> = {
      tools,
      logging: {
        level: 'info' as const,
        structured: true
      }
    };

    switch (mode) {
      case 'stdio':
        return {
          mode: 'stdio',
          stdio: {
            encoding: 'utf8' as const,
            delimiter: '\n'
          },
          ...baseConfig
        };
      
      case 'http':
        return {
          mode: 'http',
          http: {
            port: 3000,
            host: 'localhost',
            cors: true,
            rateLimit: true,
            logging: {
              level: 'info' as const,
              prettyPrint: false
            }
          },
          ...baseConfig
        };
      
      case 'both':
        return {
          mode: 'both',
          stdio: {
            encoding: 'utf8' as const,
            delimiter: '\n'
          },
          http: {
            port: 3000,
            host: 'localhost',
            cors: true,
            rateLimit: true,
            logging: {
              level: 'info' as const,
              prettyPrint: false
            }
          },
          ...baseConfig
        };
      
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
  }

  // Méthode pour créer un serveur à partir de variables d'environnement
  static createFromEnv(tools: MCPServerTool[]): MCPServerInstance {
    const mode = (process.env['MCP_SERVER_MODE'] || 'stdio') as 'stdio' | 'http' | 'both';
    
    const config = this.createDefaultConfig(mode, tools);

    // Override avec les variables d'environnement
    if (config.http) {
      config.http.port = parseInt(process.env['HTTP_PORT'] || '3000');
      config.http.host = process.env['HTTP_HOST'] || 'localhost';
      config.http.cors = process.env['HTTP_CORS'] === 'true';
      config.http.rateLimit = process.env['HTTP_RATE_LIMIT'] === 'true';
    }

    if (config.logging) {
      config.logging.level = (process.env['LOG_LEVEL'] || 'info') as any;
      config.logging.structured = process.env['LOG_STRUCTURED'] === 'true';
    }

    return this.create(config);
  }
}
