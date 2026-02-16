import { MCPServerFactory } from '../../lib/mcp/utils/server-factory';
import { MCPServerTool } from '../../lib/mcp/types';

describe('MCP Integration Tests', () => {
  let mockTools: MCPServerTool[];

  beforeEach(() => {
    mockTools = [
      {
        name: 'echo-tool',
        description: 'Echoes back the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        },
        run: jest.fn().mockImplementation(async (args: any) => {
          return { echo: args.message };
        })
      },
      {
        name: 'math-tool',
        description: 'Performs basic math operations',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        },
        run: jest.fn().mockImplementation(async (args: any) => {
          const { operation, a, b } = args;
          switch (operation) {
            case 'add': return { result: a + b };
            case 'subtract': return { result: a - b };
            case 'multiply': return { result: a * b };
            case 'divide': return { result: a / b };
            default: throw new Error('Unknown operation');
          }
        })
      }
    ];
  });

  describe('Stdio Server Integration', () => {
    test('should handle complete workflow', async () => {
      const server = MCPServerFactory.create({
        mode: 'stdio',
        tools: mockTools
      });

      expect(server).toBeDefined();
      expect(server.getAvailableTools()).toHaveLength(2);

      // Test que le serveur est bien créé
      expect(server.isServerInitialized()).toBe(false);

      // Nettoyage
      await server.stop();
    });

    test('should handle tool addition and removal', async () => {
      const server = MCPServerFactory.create({
        mode: 'stdio',
        tools: [mockTools[0]]
      });

      expect(server.getAvailableTools()).toHaveLength(1);

      // Ajouter un outil
      server.addTool(mockTools[1]);
      expect(server.getAvailableTools()).toHaveLength(2);

      // Supprimer un outil
      const removed = server.removeTool('echo-tool');
      expect(removed).toBe(true);
      expect(server.getAvailableTools()).toHaveLength(1);
      expect(server.getAvailableTools()).not.toContain('echo-tool');

      await server.stop();
    });
  });

  describe('HTTP Server Integration', () => {
    test('should handle complete workflow', async () => {
      const server = MCPServerFactory.create({
        mode: 'http',
        tools: mockTools,
        http: {
          port: 3002,
          host: 'localhost',
          cors: false,
          rateLimit: false,
          logging: false
        },
        logging: {
          level: 'error',
          structured: false
        }
      });

      expect(server).toBeDefined();
      expect(server.getAvailableTools()).toHaveLength(2);

      // Démarrer le serveur
      await server.start();
      expect(server.isServerInitialized()).toBe(false); // Pas encore initialisé via MCP

      // Test health endpoint
      const healthResponse = await fetch('http://localhost:3002/health');
      expect(healthResponse.ok).toBe(true);
      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('healthy');
      expect(healthData.tools_count).toBe(2);

      // Test documentation endpoint
      const docsResponse = await fetch('http://localhost:3002/');
      expect(docsResponse.ok).toBe(true);
      const docsData = await docsResponse.json();
      expect(docsData.name).toBe('TwinMCP Server');
      expect(docsData.tools).toHaveLength(2);

      // Nettoyage
      await server.stop();
    });

    test('should handle MCP protocol workflow', async () => {
      const server = MCPServerFactory.create({
        mode: 'http',
        tools: mockTools,
        http: {
          port: 3003,
          host: 'localhost',
          cors: false,
          rateLimit: false,
          logging: false
        },
        logging: {
          level: 'error',
          structured: false
        }
      });

      await server.start();

      // 1. Initialisation
      const initResponse = await fetch('http://localhost:3003/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {}
          }
        })
      });

      expect(initResponse.ok).toBe(true);
      const initData = await initResponse.json();
      expect(initData.result.serverInfo.name).toBe('twinmcp-server');

      // 2. Lister les outils
      const listResponse = await fetch('http://localhost:3003/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        })
      });

      expect(listResponse.ok).toBe(true);
      const listData = await listResponse.json();
      expect(listData.result.tools).toHaveLength(2);
      expect(listData.result.tools.map((t: any) => t.name)).toContain('echo-tool');
      expect(listData.result.tools.map((t: any) => t.name)).toContain('math-tool');

      // 3. Appeler l'outil echo
      const echoResponse = await fetch('http://localhost:3003/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'echo-tool',
            arguments: { message: 'Hello World' }
          }
        })
      });

      expect(echoResponse.ok).toBe(true);
      const echoData = await echoResponse.json();
      expect(echoData.result.content[0].text).toContain('Hello World');

      // 4. Appeler l'outil math
      const mathResponse = await fetch('http://localhost:3003/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'math-tool',
            arguments: { operation: 'add', a: 5, b: 3 }
          }
        })
      });

      expect(mathResponse.ok).toBe(true);
      const mathData = await mathResponse.json();
      expect(mathData.result.content[0].text).toContain('8');

      await server.stop();
    });
  });

  describe('Both Modes Integration', () => {
    test('should create both stdio and http servers', async () => {
      const servers = MCPServerFactory.create({
        mode: 'both',
        tools: mockTools,
        http: {
          port: 3004,
          host: 'localhost',
          cors: false,
          rateLimit: false,
          logging: false
        },
        logging: {
          level: 'error',
          structured: false
        }
      });

      expect('stdio' in servers && 'http' in servers).toBe(true);
      expect(servers.stdio.getAvailableTools()).toHaveLength(2);
      expect(servers.http.getAvailableTools()).toHaveLength(2);

      // Démarrer les deux serveurs
      await MCPServerFactory.startServer(servers);

      // Tester le serveur HTTP
      const healthResponse = await fetch('http://localhost:3004/health');
      expect(healthResponse.ok).toBe(true);

      // Arrêter les deux serveurs
      await MCPServerFactory.stopServer(servers);
    });

    test('should get server info for both modes', async () => {
      const servers = MCPServerFactory.create({
        mode: 'both',
        tools: mockTools,
        http: {
          port: 3005,
          host: 'localhost',
          cors: false,
          rateLimit: false,
          logging: false
        },
        logging: {
          level: 'error',
          structured: false
        }
      });

      const info = MCPServerFactory.getServerInfo(servers);
      expect(info.mode).toBe('both');
      expect(info.stdio.type).toBe('stdio');
      expect(info.http.type).toBe('http');
      expect(info.stdio.tools).toHaveLength(2);
      expect(info.http.tools).toHaveLength(2);

      await MCPServerFactory.stopServer(servers);
    });
  });

  describe('Factory Configuration', () => {
    test('should create default configurations', () => {
      const stdioConfig = MCPServerFactory.createDefaultConfig('stdio', mockTools);
      expect(stdioConfig.mode).toBe('stdio');
      expect(stdioConfig.stdio).toBeDefined();
      expect(stdioConfig.http).toBeUndefined();

      const httpConfig = MCPServerFactory.createDefaultConfig('http', mockTools);
      expect(httpConfig.mode).toBe('http');
      expect(httpConfig.http).toBeDefined();
      expect(httpConfig.stdio).toBeUndefined();
      expect(httpConfig.http!.port).toBe(3000);

      const bothConfig = MCPServerFactory.createDefaultConfig('both', mockTools);
      expect(bothConfig.mode).toBe('both');
      expect(bothConfig.stdio).toBeDefined();
      expect(bothConfig.http).toBeDefined();
    });

    test('should create server from environment variables', () => {
      // Mock des variables d'environnement
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        MCP_SERVER_MODE: 'http',
        HTTP_PORT: '3006',
        HTTP_HOST: '127.0.0.1',
        HTTP_CORS: 'true',
        HTTP_RATE_LIMIT: 'true',
        LOG_LEVEL: 'warn',
        LOG_STRUCTURED: 'true'
      };

      const server = MCPServerFactory.createFromEnv(mockTools);
      expect(server).toBeDefined();

      // Restaurer les variables d'environnement
      process.env = originalEnv;
    });
  });

  describe('Error Handling', () => {
    test('should validate configuration', () => {
      expect(() => {
        MCPServerFactory.create({
          mode: 'invalid' as any,
          tools: mockTools
        });
      }).toThrow('Invalid server mode');

      expect(() => {
        MCPServerFactory.create({
          mode: 'http',
          tools: mockTools,
          http: {
            port: 0, // Invalid port
            host: 'localhost',
            cors: false,
            rateLimit: false,
            logging: false
          },
          logging: {
            level: 'info',
            structured: false
          }
        });
      }).toThrow('HTTP port must be a valid port number');

      expect(() => {
        MCPServerFactory.create({
          mode: 'stdio',
          tools: [] // Empty tools
        });
      }).toThrow('At least one tool must be provided');
    });

    test('should handle invalid tools', () => {
      const invalidTools = [
        {
          name: '', // Invalid name
          description: 'Invalid tool',
          inputSchema: { type: 'object' },
          run: jest.fn()
        }
      ] as MCPServerTool[];

      expect(() => {
        MCPServerFactory.create({
          mode: 'stdio',
          tools: invalidTools
        });
      }).toThrow('Tool at index 0 must have a valid name');
    });
  });

  describe('Metrics Integration', () => {
    test('should provide metrics', () => {
      const metrics = MCPServerFactory.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.getMetrics).toBe('function');
      expect(typeof metrics.reset).toBe('function');
    });

    test('should reset metrics', () => {
      const metrics = MCPServerFactory.getMetrics();
      expect(() => metrics.reset()).not.toThrow();
    });
  });
});
