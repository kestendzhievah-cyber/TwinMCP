import { StdioMCPServer } from '../../../lib/mcp/servers/stdio-mcp-server';
import { MCPServerTool } from '../../../lib/mcp/types';
import { Readable, Writable } from 'stream';

describe('StdioMCPServer', () => {
  let server: StdioMCPServer;
  let mockInput: Readable;
  let mockOutput: Writable;
  let mockTool: MCPServerTool;
  let receivedMessages: string[];

  beforeEach(() => {
    // Créer des streams mock
    mockInput = new Readable();
    mockOutput = new Writable();
    receivedMessages = [];

    // Mock de l'écriture
    mockOutput.write = jest.fn((data: string) => {
      receivedMessages.push(data);
      return true;
    });

    // Mock de l'outil
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

    // Créer le serveur avec les streams mock
    server = new StdioMCPServer({ tools: [mockTool], input: mockInput, output: mockOutput });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with tools', () => {
      expect(server.getAvailableTools()).toContain('test-tool');
    });

    test('should handle empty tools array', () => {
      const emptyServer = new StdioMCPServer({ tools: [] });
      expect(emptyServer.getAvailableTools()).toHaveLength(0);
    });
  });

  describe('Message Processing', () => {
    test('should handle initialize message', async () => {
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        }
      };

      // Simuler l'entrée
      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');

      // Attendre un peu pour le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifier la réponse
      expect(receivedMessages).toHaveLength(1);
      const response = JSON.parse(receivedMessages[0]);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.serverInfo.name).toBe('twinmcp-server');
    });

    test('should handle tools/list message after initialization', async () => {
      // D'abord initialiser
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Puis lister les outils
      const listToolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };

      mockInput.emit('data', JSON.stringify(listToolsMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifier la réponse
      expect(receivedMessages).toHaveLength(2);
      const response = JSON.parse(receivedMessages[1]);
      expect(response.result.tools).toHaveLength(1);
      expect(response.result.tools[0].name).toBe('test-tool');
    });

    test('should handle tools/call message', async () => {
      // Initialiser
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Appeler l'outil
      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'hello' }
        }
      };

      mockInput.emit('data', JSON.stringify(toolCallMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifier que l'outil a été appelé
      expect(mockTool.run).toHaveBeenCalledWith({ message: 'hello' });

      // Vérifier la réponse
      expect(receivedMessages).toHaveLength(2);
      const response = JSON.parse(receivedMessages[1]);
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
    });

    test('should reject requests before initialization', async () => {
      const listToolsMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      mockInput.emit('data', JSON.stringify(listToolsMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      const response = JSON.parse(receivedMessages[0]);
      expect(response.error).toBeDefined();
      expect(response.error.message).toBe('Server not initialized');
    });

    test('should handle invalid JSON', async () => {
      mockInput.emit('data', 'invalid json\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      const response = JSON.parse(receivedMessages[0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32700); // Parse error
    });

    test('should handle unknown method', async () => {
      // Initialiser
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Envoyer une méthode inconnue
      const unknownMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'unknown/method'
      };

      mockInput.emit('data', JSON.stringify(unknownMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(2);
      const response = JSON.parse(receivedMessages[1]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601); // Method not found
    });

    test('should handle tool not found', async () => {
      // Initialiser
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Appeler un outil qui n'existe pas
      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'non-existent-tool',
          arguments: {}
        }
      };

      mockInput.emit('data', JSON.stringify(toolCallMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(2);
      const response = JSON.parse(receivedMessages[1]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Tool not found
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

    test('should handle multiple messages in buffer', async () => {
      const messages = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' }
      ];

      // Envoyer tous les messages en une fois
      const combinedMessage = messages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
      mockInput.emit('data', combinedMessage);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedMessages).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle tool execution errors', async () => {
      // Créer un outil qui échoue
      const failingTool: MCPServerTool = {
        name: 'failing-tool',
        description: 'A failing tool',
        inputSchema: { type: 'object' },
        run: jest.fn().mockRejectedValue(new Error('Tool failed'))
      };

      server.addTool(failingTool);

      // Initialiser
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      mockInput.emit('data', JSON.stringify(initializeMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Appeler l'outil qui échoue
      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'failing-tool',
          arguments: {}
        }
      };

      mockInput.emit('data', JSON.stringify(toolCallMessage) + '\n');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(2);
      const response = JSON.parse(receivedMessages[1]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32002); // Tool execution error
    });
  });
});
