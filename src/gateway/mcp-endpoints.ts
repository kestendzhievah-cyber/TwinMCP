import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCPMessage } from '../types/gateway.types';

export class MCPEndpoints {
  static async register(server: FastifyInstance) {
    // Endpoint MCP principal
    server.post('/', {
      schema: {
        description: 'MCP protocol endpoint',
        body: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', const: '2.0' },
            id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            method: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['jsonrpc', 'method']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jsonrpc: { type: 'string' },
              id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
              result: { type: 'object' },
              error: { type: 'object' }
            }
          }
        }
      }
    }, this.handleMCPRequest.bind(this));

    // Endpoint MCP OAuth
    server.post('/oauth', {
      schema: {
        description: 'MCP OAuth endpoint',
        headers: {
          Authorization: { type: 'string' }
        },
        body: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', const: '2.0' },
            id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            method: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['jsonrpc', 'method']
        }
      }
    }, this.handleMCPOAuthRequest.bind(this));
  }

  private static async handleMCPRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const mcpMessage: MCPMessage = request.body as MCPMessage;
      
      // Validation basique du message MCP
      this.validateMCPMessage(mcpMessage);
      
      // Log de la requête MCP
      request.log.info('MCP request received', {
        method: mcpMessage.method,
        id: mcpMessage.id,
        hasParams: !!mcpMessage.params
      } as any);
      
      // Pour l'instant, retourner une réponse placeholder
      // Sera remplacé par l'intégration avec le serveur MCP core
      reply.send({
        jsonrpc: '2.0',
        id: mcpMessage.id,
        result: {
          message: 'MCP endpoint ready for integration',
          method: mcpMessage.method
        }
      });
      
    } catch (error) {
      request.log.error(error, 'MCP request validation failed');
      
      reply.status(400).send({
        jsonrpc: '2.0',
        id: (request.body as any).id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: (error as Error).message
        }
      });
    }
  }

  private static async handleMCPOAuthRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        reply.status(401).send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: 'Missing Authorization header'
          }
        });
        return;
      }
      
      const mcpMessage: MCPMessage = request.body as MCPMessage;
      this.validateMCPMessage(mcpMessage);
      
      request.log.info('MCP OAuth request received', {
        method: mcpMessage.method,
        id: mcpMessage.id,
        authType: authHeader.startsWith('Bearer ') ? 'Bearer' : 'Other'
      } as any);
      
      // Pour l'instant, valider uniquement la présence du token
      // Sera remplacé par l'implémentation OAuth complète
      reply.send({
        jsonrpc: '2.0',
        id: mcpMessage.id,
        result: {
          message: 'OAuth endpoint ready for integration',
          method: mcpMessage.method,
          authenticated: true
        }
      });
      
    } catch (error) {
      request.log.error(error, 'MCP OAuth request validation failed');
      
      reply.status(400).send({
        jsonrpc: '2.0',
        id: (request.body as any).id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: (error as Error).message
        }
      });
    }
  }

  private static validateMCPMessage(message: MCPMessage): void {
    if (!message.jsonrpc || message.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    
    if (!message.method || typeof message.method !== 'string') {
      throw new Error('Method is required and must be a string');
    }
    
    if (message.id !== undefined && 
        typeof message.id !== 'string' && 
        typeof message.id !== 'number') {
      throw new Error('ID must be a string or number');
    }
  }
}
