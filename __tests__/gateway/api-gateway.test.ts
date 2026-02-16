import { APIGateway } from '../../src/gateway/api-gateway';
import { APIGatewayConfig } from '../../src/types/gateway.types';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    status: 'ready',
  }));
});

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    oAuthClient: { findFirst: jest.fn() },
    oAuthAuthorizationCode: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    oAuthAccessToken: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    oAuthRefreshToken: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  })),
}));

describe('APIGateway', () => {
  let gateway: APIGateway;
  let config: APIGatewayConfig;

  beforeEach(() => {
    config = {
      server: { host: 'localhost', port: 0, trustProxy: false },
      cors: { enabled: true, origins: ['*'], credentials: false },
      logging: { level: 'error', structured: false, requestLogging: false },
      endpoints: { mcp: '/mcp', oauth: '/mcp/oauth', health: '/health', metrics: '/metrics' },
      rateLimit: { enabled: false, globalLimit: 100, windowMs: 60000 }
    };
    gateway = new APIGateway(config);
  });

  afterEach(async () => {
    if (gateway) {
      await gateway.stop();
    }
  });

  test('should start server successfully', async () => {
    await gateway.start();
    expect(gateway.getServer().server.listening).toBe(true);
  });

  test('should handle health check', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const response = await fetch(`http://localhost:${port}/health`);
    expect(response.ok).toBe(true);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
  });

  test('should handle documentation endpoint', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const response = await fetch(`http://localhost:${port}/`);
    expect(response.ok).toBe(true);
    
    const docs = await response.json();
    expect(docs.name).toBe('TwinMCP API Gateway');
    expect(docs.endpoints).toBeDefined();
  });

  test('should handle MCP request', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };
    
    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest)
    });
    
    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.id).toBe(1);
    expect(result.result).toBeDefined();
  });

  test('should handle MCP OAuth request with authorization', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };
    
    const response = await fetch(`http://localhost:${port}/mcp/oauth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(mcpRequest)
    });
    
    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.id).toBe(2);
    expect(result.result.authenticated).toBe(true);
  });

  test('should reject MCP OAuth request without authorization', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list'
    };
    
    const response = await fetch(`http://localhost:${port}/mcp/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest)
    });
    
    expect(response.status).toBe(401);
    const result = await response.json();
    expect(result.error.code).toBe(-32001);
    expect(result.error.message).toBe('Unauthorized');
  });

  test('should handle invalid MCP request', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const invalidRequest = {
      jsonrpc: '1.0', // Invalid version
      id: 4,
      method: 'tools/list'
    };
    
    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidRequest)
    });
    
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error.code).toBe(-32600);
    expect(result.error.message).toBe('Invalid Request');
  });

  test('should handle 404 for unknown routes', async () => {
    await gateway.start();
    
    const address = gateway.getServer().server.address();
    const port = typeof address === 'string' ? parseInt(address.split(':')[1] || '0') : address?.port || 0;
    
    const response = await fetch(`http://localhost:${port}/unknown`);
    expect(response.status).toBe(404);
    
    const error = await response.json();
    expect(error.error).toBe('Not Found');
  });
});
