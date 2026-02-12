import { APIGatewayConfig } from '../types/gateway.types';

export const gatewayConfig: APIGatewayConfig = {
  server: {
    host: process.env['GATEWAY_HOST'] || '0.0.0.0',
    port: parseInt(process.env['GATEWAY_PORT'] || '3000'),
    trustProxy: process.env['TRUST_PROXY'] === 'true'
  },
  cors: {
    enabled: process.env['CORS_ENABLED'] !== 'false',
    origins: process.env['CORS_ORIGINS']?.split(',') || ['*'],
    credentials: process.env['CORS_CREDENTIALS'] === 'true'
  },
  logging: {
    level: (process.env['LOG_LEVEL'] as any) || 'info',
    structured: process.env['LOG_STRUCTURED'] === 'true',
    requestLogging: process.env['LOG_REQUESTS'] !== 'false'
  },
  endpoints: {
    mcp: '/mcp',
    oauth: '/mcp/oauth',
    health: '/health',
    metrics: '/metrics'
  },
  rateLimit: {
    enabled: process.env['RATE_LIMIT_ENABLED'] === 'true',
    globalLimit: parseInt(process.env['RATE_LIMIT_GLOBAL'] || '100'),
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW'] || '60000')
  }
};
