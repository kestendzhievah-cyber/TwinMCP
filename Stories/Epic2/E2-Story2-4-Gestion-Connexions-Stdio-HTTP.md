# Story 2.4: Gestion des connexions stdio et HTTP

## Résumé

**Epic**: 2 - Serveur MCP Core  
**Story**: 2.4 - Gestion des connexions stdio et HTTP  
**Description**: Support des deux modes de connexion MCP  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Implémenter les deux modes de connexion supportés par le protocole MCP (Model Context Protocol) :
- **stdio**: Pour les connexions locales avec les IDE
- **HTTP**: Pour les connexions distantes via API Gateway

---

## Prérequis

- Story 2.1: Package NPM TwinMCP Server complétée
- Story 2.2: Outil resolve-library-id fonctionnel
- Story 2.3: Outil query-docs fonctionnel
- Node.js 20+ avec support ES modules

---

## Spécifications Techniques

### 1. Architecture de connexion

```typescript
interface MCPServerConfig {
  mode: 'stdio' | 'http' | 'both';
  stdio?: {
    encoding: 'utf8';
    delimiter: '\n';
  };
  http?: {
    port: number;
    host: string;
    cors: boolean;
    rateLimit: boolean;
  };
  tools: MCPTool[];
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
  };
}
```

### 2. Protocole MCP

```typescript
interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

---

## Tâches Détaillées

### Étape 1: Implémenter le serveur stdio pour usage local

**Objectif**: Créer un serveur MCP qui communique via stdin/stdout

**Actions**:
1. Créer la classe `StdioMCPServer`
2. Implémenter la lecture depuis stdin
3. Gérer l'écriture vers stdout
4. Ajouter la gestion des erreurs de flux

**Implémentation**:
```typescript
// src/servers/stdio-mcp-server.ts
import { Readable, Writable } from 'stream';
import { MCPMessage, MCPTool } from '../types/mcp.types';

export class StdioMCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private input: Readable;
  private output: Writable;
  private buffer: string = '';
  private messageId: number = 1;

  constructor(config: { tools: MCPTool[] }) {
    this.input = process.stdin;
    this.output = process.stdout;
    
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
      
      if (message.method === 'initialize') {
        await this.handleInitialize(message);
      } else if (message.method === 'tools/list') {
        await this.handleListTools(message);
      } else if (message.method === 'tools/call') {
        await this.handleToolCall(message);
      } else {
        this.sendError(message.id, -32601, 'Method not found');
      }
    } catch (error) {
      this.sendError(null, -32700, 'Parse error', error.message);
    }
  }

  private async handleInitialize(message: MCPMessage): Promise<void> {
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {}
        },
        serverInfo: {
          name: 'twinmcp-server',
          version: '1.0.0'
        }
      }
    };
    
    this.sendMessage(response);
  }

  private async handleListTools(message: MCPMessage): Promise<void> {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: { tools }
    };
    
    this.sendMessage(response);
  }

  private async handleToolCall(message: MCPMessage): Promise<void> {
    const { name, arguments: args } = message.params;
    
    if (!this.tools.has(name)) {
      this.sendError(message.id, -32602, 'Tool not found', name);
      return;
    }
    
    try {
      const tool = this.tools.get(name)!;
      const result = await tool.run(args);
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
      
      this.sendMessage(response);
    } catch (error) {
      this.sendError(message.id, -32603, 'Internal error', error.message);
    }
  }

  private sendMessage(message: MCPMessage): void {
    const jsonMessage = JSON.stringify(message) + '\n';
    this.output.write(jsonMessage);
  }

  private sendError(id: any, code: number, message: string, data?: any): void {
    const errorResponse: MCPMessage = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };
    
    this.sendMessage(errorResponse);
  }

  private handleError(context: string, error: Error): void {
    console.error(`[${context}] ${error.message}`, error.stack);
  }

  async start(): Promise<void> {
    console.error('TwinMCP Server started in stdio mode');
    // Le serveur est maintenant à l'écoute sur stdin/stdout
  }

  async stop(): Promise<void> {
    this.input.destroy();
    this.output.destroy();
  }
}
```

**Validation**:
- Tests avec stdin/stdout simulés
- Validation du format JSON-RPC
- Tests des messages d'erreur

---

### Étape 2: Implémenter le serveur HTTP pour usage distant

**Objectif**: Créer un serveur MCP qui communique via HTTP/HTTPS

**Actions**:
1. Créer la classe `HttpMCPServer`
2. Configurer Fastify avec CORS
3. Implémenter les endpoints MCP
4. Ajouter le middleware de logging

**Implémentation**:
```typescript
// src/servers/http-mcp-server.ts
import Fastify, { FastifyInstance } from 'fastify';
import { MCPMessage, MCPTool } from '../types/mcp.types';

export class HttpMCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private server: FastifyInstance;
  private config: HttpServerConfig;

  constructor(config: HttpServerConfig & { tools: MCPTool[] }) {
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
    // CORS
    if (this.config.cors) {
      this.server.register(import('@fastify/cors'), {
        origin: true,
        credentials: true
      });
    }
    
    // Rate limiting
    if (this.config.rateLimit) {
      this.server.register(import('@fastify/rate-limit'), {
        max: 100,
        timeWindow: '1 minute'
      });
    }
    
    // Request logging
    this.server.addHook('preHandler', async (request, reply) => {
      request.log.info({
        method: request.method,
        url: request.url,
        headers: request.headers
      });
    });
  }

  private setupRoutes(): void {
    // Endpoint principal MCP
    this.server.post('/mcp', async (request, reply) => {
      try {
        const message: MCPMessage = request.body as MCPMessage;
        const response = await this.processMessage(message);
        return response;
      } catch (error) {
        this.server.log.error(error);
        reply.status(500);
        return {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          }
        };
      }
    });
    
    // Endpoint OAuth (pour Epic 3)
    this.server.post('/mcp/oauth', async (request, reply) => {
      // Sera implémenté dans Epic 3
      reply.status(501);
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'OAuth endpoint not implemented yet'
        }
      };
    });
    
    // Health check
    this.server.get('/health', async (request, reply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        tools_count: this.tools.size
      };
    });
    
    // Documentation
    this.server.get('/', async (request, reply) => {
      return {
        name: 'TwinMCP Server',
        version: '1.0.0',
        description: 'MCP server for documentation queries',
        endpoints: {
          mcp: 'POST /mcp',
          health: 'GET /health',
          oauth: 'POST /mcp/oauth'
        },
        tools: Array.from(this.tools.keys())
      };
    });
  }

  private async processMessage(message: MCPMessage): Promise<MCPMessage> {
    if (message.method === 'initialize') {
      return this.handleInitialize(message);
    } else if (message.method === 'tools/list') {
      return this.handleListTools(message);
    } else if (message.method === 'tools/call') {
      return await this.handleToolCall(message);
    } else {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
    }
  }

  private handleInitialize(message: MCPMessage): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {}
        },
        serverInfo: {
          name: 'twinmcp-server',
          version: '1.0.0'
        }
      }
    };
  }

  private handleListTools(message: MCPMessage): MCPMessage {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: { tools }
    };
  }

  private async handleToolCall(message: MCPMessage): Promise<MCPMessage> {
    const { name, arguments: args } = message.params;
    
    if (!this.tools.has(name)) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: 'Tool not found',
          data: name
        }
      };
    }
    
    try {
      const tool = this.tools.get(name)!;
      const result = await tool.run(args);
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Tool execution error',
          data: error.message
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
    } catch (error) {
      this.server.log.error(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.server.close();
  }
}

interface HttpServerConfig {
  port: number;
  host: string;
  cors: boolean;
  rateLimit: boolean;
  logging: any;
}
```

**Validation**:
- Tests des endpoints HTTP
- Validation CORS
- Tests de rate limiting

---

### Étape 3: Gérer la sérialisation/désérialisation MCP

**Objectif**: Créer un service robuste pour la manipulation des messages MCP

**Actions**:
1. Créer le service `MCPMessageSerializer`
2. Implémenter la validation JSON-RPC
3. Ajouter la gestion des erreurs
4. Optimiser la performance

**Implémentation**:
```typescript
// src/services/mcp-serializer.service.ts
import { MCPMessage } from '../types/mcp.types';

export class MCPMessageSerializer {
  private static readonly VALID_METHODS = [
    'initialize',
    'tools/list',
    'tools/call',
    'notifications/message',
    'notifications/resources/updated'
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
      throw new Error(`Failed to serialize MCP message: ${error.message}`);
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
      throw new Error(`Failed to deserialize MCP message: ${error.message}`);
    }
  }

  static createResponse(id: any, result?: any, error?: any): MCPMessage {
    const message: MCPMessage = {
      jsonrpc: '2.0',
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
      jsonrpc: '2.0',
      method,
      params
    };
  }

  static validateToolCall(params: any): { name: string; arguments: any } {
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
}
```

**Validation**:
- Tests de sérialisation/désérialisation
- Validation des messages invalides
- Tests de performance

---

### Étape 4: Ajouter le logging et le monitoring

**Objectif**: Implémenter un système de monitoring complet pour les deux modes

**Actions**:
1. Créer le service `MCPServerMetrics`
2. Implémenter le logging structuré
3. Ajouter les métriques de performance
4. Configurer les alertes

**Implémentation**:
```typescript
// src/services/mcp-metrics.service.ts
import { EventEmitter } from 'events';

export class MCPServerMetrics extends EventEmitter {
  private metrics: Map<string, any> = new Map();
  private startTime: Date = new Date();

  constructor() {
    super();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics.set('requests_total', 0);
    this.metrics.set('requests_success', 0);
    this.metrics.set('requests_error', 0);
    this.metrics.set('response_time_avg', 0);
    this.metrics.set('active_connections', 0);
    this.metrics.set('tools_calls_total', 0);
    this.metrics.set('tools_calls_success', 0);
    this.metrics.set('tools_calls_error', 0);
  }

  recordRequest(method: string, duration: number, success: boolean): void {
    this.metrics.set('requests_total', this.metrics.get('requests_total') + 1);
    
    if (success) {
      this.metrics.set('requests_success', this.metrics.get('requests_success') + 1);
    } else {
      this.metrics.set('requests_error', this.metrics.get('requests_error') + 1);
    }
    
    // Mettre à jour le temps de réponse moyen
    const currentAvg = this.metrics.get('response_time_avg');
    const totalRequests = this.metrics.get('requests_total');
    const newAvg = (currentAvg * (totalRequests - 1) + duration) / totalRequests;
    this.metrics.set('response_time_avg', newAvg);
    
    this.emit('request', {
      method,
      duration,
      success,
      timestamp: new Date()
    });
  }

  recordToolCall(toolName: string, duration: number, success: boolean): void {
    this.metrics.set('tools_calls_total', this.metrics.get('tools_calls_total') + 1);
    
    if (success) {
      this.metrics.set('tools_calls_success', this.metrics.get('tools_calls_success') + 1);
    } else {
      this.metrics.set('tools_calls_error', this.metrics.get('tools_calls_error') + 1);
    }
    
    this.emit('tool_call', {
      toolName,
      duration,
      success,
      timestamp: new Date()
    });
  }

  incrementActiveConnections(): void {
    this.metrics.set('active_connections', this.metrics.get('active_connections') + 1);
  }

  decrementActiveConnections(): void {
    this.metrics.set('active_connections', Math.max(0, this.metrics.get('active_connections') - 1));
  }

  getMetrics(): any {
    return {
      ...Object.fromEntries(this.metrics),
      uptime_seconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      timestamp: new Date().toISOString()
    };
  }

  getHealthStatus(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const errorRate = this.metrics.get('requests_error') / this.metrics.get('requests_total');
    
    if (errorRate > 0.1) {
      issues.push('High error rate');
    }
    
    if (this.metrics.get('response_time_avg') > 1000) {
      issues.push('High response time');
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }
}
```

**Validation**:
- Tests de collecte de métriques
- Validation des seuils d'alerte
- Tests de reporting

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── servers/
│   ├── stdio-mcp-server.ts
│   ├── http-mcp-server.ts
│   └── index.ts
├── services/
│   ├── mcp-serializer.service.ts
│   └── mcp-metrics.service.ts
├── types/
│   └── mcp.types.ts
└── utils/
    └── server-factory.ts
```

### Factory pattern

```typescript
// src/utils/server-factory.ts
import { StdioMCPServer } from '../servers/stdio-mcp-server';
import { HttpMCPServer } from '../servers/http-mcp-server';
import { MCPTool } from '../types/mcp.types';

export class MCPServerFactory {
  static create(config: {
    mode: 'stdio' | 'http' | 'both';
    tools: MCPTool[];
    http?: {
      port: number;
      host: string;
      cors?: boolean;
      rateLimit?: boolean;
    };
    logging?: any;
  }) {
    if (config.mode === 'stdio') {
      return new StdioMCPServer({ tools: config.tools });
    } else if (config.mode === 'http') {
      return new HttpMCPServer({
        ...config.http,
        tools: config.tools,
        logging: config.logging
      });
    } else if (config.mode === 'both') {
      return {
        stdio: new StdioMCPServer({ tools: config.tools }),
        http: new HttpMCPServer({
          ...config.http,
          tools: config.tools,
          logging: config.logging
        })
      };
    } else {
      throw new Error(`Unknown server mode: ${config.mode}`);
    }
  }
}
```

---

## Tests

### Tests unitaires

```typescript
// __tests__/servers/stdio-mcp-server.test.ts
describe('StdioMCPServer', () => {
  let server: StdioMCPServer;
  let mockInput: Readable;
  let mockOutput: Writable;

  beforeEach(() => {
    mockInput = new Readable();
    mockOutput = new Writable();
    server = new StdioMCPServer({
      tools: [mockTool]
    });
  });

  test('should handle initialize message', async () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    };
    
    // Simuler l'entrée
    mockInput.emit('data', JSON.stringify(message) + '\n');
    
    // Vérifier la sortie
    await new Promise(resolve => setTimeout(resolve, 100));
    // Assertions sur la réponse
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/mcp-protocol.test.ts
describe('MCP Protocol Integration', () => {
  test('stdio server should handle complete workflow', async () => {
    const server = MCPServerFactory.create({
      mode: 'stdio',
      tools: [resolveLibraryTool, queryDocsTool]
    });
    
    // Test du workflow complet
    await server.start();
    // Simuler les messages MCP
    // Vérifier les réponses
  });

  test('http server should handle complete workflow', async () => {
    const server = MCPServerFactory.create({
      mode: 'http',
      tools: [resolveLibraryTool, queryDocsTool],
      http: { port: 3001, host: 'localhost', cors: true, rateLimit: false }
    });
    
    await server.start();
    
    // Test avec fetch/axios
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
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de réponse**: < 100ms (stdio), < 200ms (HTTP)
- **Connexions simultanées**: 1000+ (HTTP)
- **Memory usage**: < 100MB par instance
- **CPU usage**: < 10% normal, < 50% peak

### Optimisations

1. **Connection pooling** pour HTTP
2. **Message batching** pour stdio
3. **Compression** gzip pour HTTP
4. **Keep-alive** connections

---

## Monitoring et Logging

### Logs structurés

```typescript
logger.info('MCP request processed', {
  server_mode: 'stdio',
  method: 'tools/call',
  tool_name: 'query-docs',
  duration_ms: 45,
  success: true,
  client_id: 'vscode-extension-123'
});
```

### Métriques Prometheus

```typescript
// src/metrics/mcp-server.metrics.ts
export const MCPServerMetrics = {
  requestsTotal: new Counter({
    name: 'mcp_requests_total',
    help: 'Total MCP requests',
    labelNames: ['mode', 'method', 'status']
  }),
  
  responseTime: new Histogram({
    name: 'mcp_response_time_seconds',
    help: 'MCP response time',
    labelNames: ['mode', 'method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1.0]
  }),
  
  activeConnections: new Gauge({
    name: 'mcp_active_connections',
    help: 'Active MCP connections',
    labelNames: ['mode']
  })
};
```

---

## Dépendances

### Packages requis

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/rate-limit": "^9.0.0",
    "winston": "^3.11.0",
    "prom-client": "^15.0.0"
  }
}
```

---

## Configuration

### Environment variables

```bash
# Mode du serveur
MCP_SERVER_MODE=stdio|http|both

# Configuration HTTP
HTTP_PORT=3000
HTTP_HOST=localhost
HTTP_CORS=true
HTTP_RATE_LIMIT=true

# Logging
LOG_LEVEL=info
LOG_STRUCTURED=true

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
```

### Fichier de configuration

```typescript
// config/mcp-server.config.ts
export const mcpServerConfig = {
  mode: process.env.MCP_SERVER_MODE || 'stdio',
  http: {
    port: parseInt(process.env.HTTP_PORT || '3000'),
    host: process.env.HTTP_HOST || 'localhost',
    cors: process.env.HTTP_CORS === 'true',
    rateLimit: process.env.HTTP_RATE_LIMIT === 'true'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    structured: process.env.LOG_STRUCTURED === 'true'
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT || '9090')
  }
};
```

---

## Risques et Mitigations

### Risques identifiés

1. **Memory leak** → Monitoring et cleanup
2. **Connection exhaustion** → Rate limiting
3. **Message parsing errors** → Validation robuste
4. **Performance degradation** → Monitoring actif

### Stratégies de mitigation

1. **Health checks** automatiques
2. **Circuit breakers** pour les erreurs
3. **Graceful shutdown** propre
4. **Resource limits** configurables

---

## Livrables

1. **Serveur stdio MCP** complet et testé
2. **Serveur HTTP MCP** complet et testé
3. **Service de sérialisation** robuste
4. **Système de monitoring** complet
5. **Documentation** d'API
6. **Tests** unitaires et d'intégration

---

## Critères d'Achèvement

✅ Les deux modes de connexion sont fonctionnels  
✅ Le protocole MCP est correctement implémenté  
✅ Les erreurs sont gérées proprement  
✅ Le monitoring est en place  
✅ Les tests passent avec > 90% de couverture  
✅ Les performances respectent les cibles  
✅ La documentation est complète  
✅ La configuration est flexible  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 4-5 jours
- **Assigné à**: À définir
- **Réviseur**: À définir
