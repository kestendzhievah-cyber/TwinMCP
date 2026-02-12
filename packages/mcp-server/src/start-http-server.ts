#!/usr/bin/env node
import { TwinMCPHttpServer, ApiKeyValidationResult, UsageTrackingData } from './http-server';
import { MCPLogger } from './utils/logger';

interface ValidationResponse {
  userId: string;
  apiKeyId: string;
  tier: string;
  quotaDaily: number;
  quotaMonthly: number;
  usedDaily: number;
  usedMonthly: number;
}

interface ErrorResponse {
  message?: string;
  code?: string;
}

const logger = MCPLogger.create('TwinMCPStartup');

// Configuration from environment variables
const PORT = parseInt(process.env['TWINMCP_PORT'] || '3001', 10);
const HOST = process.env['TWINMCP_HOST'] || '0.0.0.0';
const CORS_ORIGINS = process.env['TWINMCP_CORS_ORIGINS']?.split(',') || ['*'];
const API_BASE_URL = process.env['TWINMCP_API_BASE_URL'] || 'http://localhost:3000';

// API Key validation function - calls your SaaS API
async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    // Call your SaaS authentication endpoint
    const response = await fetch(`${API_BASE_URL}/api/auth/validate-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Authentication failed' })) as ErrorResponse;
      return {
        valid: false,
        error: error.message || 'Invalid API key',
        errorCode: error.code || 'INVALID_API_KEY',
      };
    }

    const data = await response.json() as ValidationResponse;
    
    return {
      valid: true,
      userId: data.userId,
      apiKeyId: data.apiKeyId,
      tier: data.tier,
      quotaDaily: data.quotaDaily,
      quotaMonthly: data.quotaMonthly,
      usedDaily: data.usedDaily,
      usedMonthly: data.usedMonthly,
    };

  } catch (error) {
    logger.error('API key validation error', error);
    return {
      valid: false,
      error: 'Authentication service unavailable',
      errorCode: 'AUTH_SERVICE_ERROR',
    };
  }
}

// Usage tracking function - calls your SaaS API
async function trackUsage(data: UsageTrackingData): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/usage/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env['TWINMCP_INTERNAL_KEY'] || '',
      },
      body: JSON.stringify({
        apiKeyId: data.apiKeyId,
        userId: data.userId,
        toolName: data.toolName,
        libraryId: data.libraryId,
        query: data.query,
        tokensReturned: data.tokensReturned,
        responseTimeMs: data.responseTimeMs,
        success: data.success,
        errorMessage: data.errorMessage,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error('Usage tracking error', error);
  }
}

async function main() {
  logger.info('Starting TwinMCP HTTP Server...');
  logger.info(`Configuration: PORT=${PORT}, HOST=${HOST}, API_BASE_URL=${API_BASE_URL}`);

  const mcpConfig = process.env['TWINMCP_API_KEY'] 
    ? { serverUrl: API_BASE_URL, apiKey: process.env['TWINMCP_API_KEY'] }
    : { serverUrl: API_BASE_URL };

  const server = new TwinMCPHttpServer(
    {
      port: PORT,
      host: HOST,
      corsOrigins: CORS_ORIGINS,
      apiKeyValidation: validateApiKey,
      usageTracking: trackUsage,
    },
    mcpConfig
  );

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  await server.start();
  
  logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                  TwinMCP Server Started                      ║
╠══════════════════════════════════════════════════════════════╣
║  Server URL: http://${HOST}:${PORT}                          
║  Health:     http://${HOST}:${PORT}/health                   
║  API Info:   http://${HOST}:${PORT}/api/info                 
║  Tools:      http://${HOST}:${PORT}/api/mcp/tools            
║  Call Tool:  POST http://${HOST}:${PORT}/api/mcp/call        
╚══════════════════════════════════════════════════════════════╝
  `);
}

main().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
