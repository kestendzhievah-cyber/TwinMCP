import { MCPMessage, MCPMethods, MCPToolCallParams } from '../types';

export class MCPMessageSerializer {
  private static readonly VALID_METHODS = [
    MCPMethods.Initialize,
    MCPMethods.ToolsList,
    MCPMethods.ToolsCall,
    MCPMethods.NotificationsMessage,
    MCPMethods.NotificationsResourcesUpdated
  ];

  static serialize(message: MCPMessage): string {
    try {
      const jsonMessage = JSON.stringify(message);
      
      // Validation basique
      if (!jsonMessage.includes('jsonrpc')) {
        throw new Error('Invalid MCP message format');
      }
      
      return jsonMessage;
    } catch (error) {
      throw new Error(`Failed to serialize MCP message: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
  }

  static deserialize(rawMessage: string): MCPMessage {
    try {
      const message = JSON.parse(rawMessage);
      
      // Validation JSON-RPC 2.0
      if (message.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }
      
      // Validation de la méthode
      if (message.method && !this.VALID_METHODS.includes(message.method)) {
        throw new Error(`Unknown method: ${message.method}`);
      }
      
      // Validation de l'ID
      if (message.id !== undefined && typeof message.id !== 'string' && typeof message.id !== 'number') {
        throw new Error('Invalid message ID type');
      }
      
      return message;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON parse error: ${error.message}`);
      }
      throw new Error(`Failed to deserialize MCP message: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
    }
  }

  static createResponse(id: string | number | undefined, result?: any, error?: any): MCPMessage {
    const message: MCPMessage = {
      jsonrpc: '2.0' as const,
      id
    };
    
    if (result !== undefined) {
      message.result = result;
    }
    
    if (error !== undefined) {
      message.error = error;
    }
    
    return message;
  }

  static createNotification(method: string, params?: any): MCPMessage {
    return {
      jsonrpc: '2.0' as const,
      method,
      params
    };
  }

  static validateToolCall(params: any): MCPToolCallParams {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid tool call parameters');
    }
    
    if (!params.name || typeof params.name !== 'string') {
      throw new Error('Tool name is required');
    }
    
    return {
      name: params.name,
      arguments: params.arguments || {}
    };
  }

  static validateInitializeParams(params: any): any {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid initialize parameters');
    }

    // Valider les paramètres client si présents
    if (params.clientInfo) {
      if (!params.clientInfo.name || typeof params.clientInfo.name !== 'string') {
        throw new Error('Client name is required in clientInfo');
      }
      if (!params.clientInfo.version || typeof params.clientInfo.version !== 'string') {
        throw new Error('Client version is required in clientInfo');
      }
    }

    return params;
  }

  static createInitializeResponse(id: string | number, serverInfo: any, capabilities: any): MCPMessage {
    return this.createResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities,
      serverInfo
    });
  }

  static createToolsListResponse(id: string | number, tools: any[]): MCPMessage {
    return this.createResponse(id, { tools });
  }

  static createToolCallResponse(id: string | number, result: any): MCPMessage {
    return this.createResponse(id, {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    });
  }

  static createErrorResponse(id: string | number | undefined, code: number, message: string, data?: any): MCPMessage {
    return this.createResponse(id, undefined, {
      code,
      message,
      data
    });
  }

  static isValidMessage(message: any): message is MCPMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      message.jsonrpc === '2.0' &&
      (message.id === undefined || typeof message.id === 'string' || typeof message.id === 'number') &&
      (message.method === undefined || typeof message.method === 'string') &&
      (message.result === undefined || message.error === undefined || message.result !== undefined || message.error !== undefined)
    );
  }

  static isRequest(message: MCPMessage): boolean {
    return message.method !== undefined;
  }

  static isResponse(message: MCPMessage): boolean {
    return message.method === undefined && (message.result !== undefined || message.error !== undefined);
  }

  static isNotification(message: MCPMessage): boolean {
    return message.method !== undefined && message.id === undefined;
  }

  static extractMethodName(message: MCPMessage): string | null {
    return message.method || null;
  }

  static extractId(message: MCPMessage): string | number | undefined {
    return message.id;
  }

  static hasError(message: MCPMessage): boolean {
    return message.error !== undefined;
  }

  static getError(message: MCPMessage): any {
    return message.error;
  }

  static getResult(message: MCPMessage): any {
    return message.result;
  }

  // Méthodes utilitaires pour le débogage
  static prettyPrint(message: MCPMessage): string {
    return JSON.stringify(message, null, 2);
  }

  static summarize(message: MCPMessage): string {
    const parts = ['MCP'];
    
    if (message.id !== undefined) {
      parts.push(`#${message.id}`);
    }
    
    if (message.method) {
      parts.push(message.method);
    }
    
    if (message.result) {
      parts.push('✓');
    }
    
    if (message.error) {
      parts.push(`✗(${message.error.code})`);
    }
    
    return parts.join(' ');
  }
}
