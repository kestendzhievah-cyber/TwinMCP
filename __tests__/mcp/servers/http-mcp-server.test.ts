import { HttpMCPServer } from '../../../lib/mcp/servers/http-mcp-server';
import { MCPServerTool } from '../../../lib/mcp/types';

describe('HttpMCPServer', () => {
  let server: HttpMCPServer;
  let mockTool: MCPServerTool;

  beforeEach(() => {
    mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      },
      run: jest.fn().mockResolvedValue({ result: 'success' })
    };

    server = new HttpMCPServer({
      port: 3001,
      host: 'localhost',
      cors: false,
      rateLimit: false,
      logging: false,
      tools: [mockTool]
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with tools', () => {
      expect(server.getAvailableTools()).toContain('test-tool');
    });

    test('should handle empty tools array', () => {
      const emptyServer = new HttpMCPServer({
        port: 3002,
        host: 'localhost',
        cors: false,
        rateLimit: false,
        logging: false,
        tools: []
      });
      expect(emptyServer.getAvailableTools()).toHaveLength(0);
    });
  });

  describe('HTTP Endpoints', () => {
    test('should handle POST /mcp initialize', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/mcp', {
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

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe(1);
      expect(result.result).toBeDefined();
      expect(result.result.serverInfo.name).toBe('twinmcp-server');
    });

    test('should handle POST /mcp tools/list after initialization', async () => {
      await server.start();
      
      // D'abord initialiser
      const initResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      expect(initResponse.ok).toBe(true);

      // Puis lister les outils
      const listResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        })
      });

      expect(listResponse.ok).toBe(true);
      const result = await listResponse.json();
      expect(result.result.tools).toHaveLength(1);
      expect(result.result.tools[0].name).toBe('test-tool');
    });

    test('should handle POST /mcp tools/call', async () => {
      await server.start();
      
      // Initialiser
      const initResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      expect(initResponse.ok).toBe(true);

      // Appeler l'outil
      const toolCallResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'test-tool',
            arguments: { message: 'hello' }
          }
        })
      });

      expect(toolCallResponse.ok).toBe(true);
      const result = await toolCallResponse.json();
      expect(result.result.content).toBeDefined();
      expect(result.result.content[0].type).toBe('text');
      
      // Vérifier que l'outil a été appelé
      expect(mockTool.run).toHaveBeenCalledWith({ message: 'hello' });
    });

    test('should handle GET /health', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/health');
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('http');
      expect(result.tools_count).toBe(1);
    });

    test('should handle GET /', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/');
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.name).toBe('TwinMCP Server');
      expect(result.mode).toBe('http');
      expect(result.endpoints).toBeDefined();
    });

    test('should handle GET /metrics', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/metrics');
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.tools).toBeDefined();
    });

    test('should handle POST /mcp/oauth (not implemented)', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/mcp/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(501);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('OAuth endpoint not implemented yet');
    });
  });

  describe('Error Handling', () => {
    test('should reject requests before initialization', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Server not initialized');
    });

    test('should handle invalid JSON', async () => {
      await server.start();
      
      const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32700); // Parse error
    });

    test('should handle unknown method', async () => {
      await server.start();
      
      // Initialiser
      const initResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      expect(initResponse.ok).toBe(true);

      // Envoyer une méthode inconnue
      const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'unknown/method'
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32601); // Method not found
    });

    test('should handle tool not found', async () => {
      await server.start();
      
      // Initialiser
      const initResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      expect(initResponse.ok).toBe(true);

      // Appeler un outil qui n'existe pas
      const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'non-existent-tool',
            arguments: {}
          }
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32602); // Tool not found
    });

    test('should handle tool execution errors', async () => {
      // Créer un outil qui échoue
      const failingTool: MCPServerTool = {
        name: 'failing-tool',
        description: 'A failing tool',
        inputSchema: { type: 'object' },
        run: jest.fn().mockRejectedValue(new Error('Tool failed'))
      };

      server.addTool(failingTool);
      await server.start();
      
      // Initialiser
      const initResponse = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      expect(initResponse.ok).toBe(true);

      // Appeler l'outil qui échoue
      const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'failing-tool',
            arguments: {}
          }
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32603); // Tool execution error
    });
  });

  describe('Tool Management', () => {
    test('should add tool dynamically', () => {
      const newTool: MCPServerTool = {
        name: 'new-tool',
        description: 'A new tool',
        inputSchema: { type: 'object' },
        run: jest.fn()
      };

      server.addTool(newTool);
      expect(server.getAvailableTools()).toContain('new-tool');
    });

    test('should remove tool', () => {
      const removed = server.removeTool('test-tool');
      expect(removed).toBe(true);
      expect(server.getAvailableTools()).not.toContain('test-tool');
    });

    test('should return false when removing non-existent tool', () => {
      const removed = server.removeTool('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should track initialization state', () => {
      expect(server.isServerInitialized()).toBe(false);
    });

    test('should get server instance for testing', () => {
      const instance = server.getServerInstance();
      expect(instance).toBeDefined();
    });
  });
});
