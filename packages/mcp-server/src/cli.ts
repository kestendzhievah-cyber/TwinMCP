#!/usr/bin/env node

import { TwinMCPServer } from './server';
import { MCPLogger } from './utils/logger';

async function main() {
  const logger = MCPLogger.create('TwinMCP-CLI');

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'version':
      console.log('TwinMCP Server v1.0.0');
      process.exit(0);

    case 'help':
      console.log(`
TwinMCP Server - Documentation and code snippets for any library

Usage:
  twinmcp-server              Start the MCP server (stdio mode)
  twinmcp-server version      Show version
  twinmcp-server help         Show this help

Environment Variables:
  TWINMCP_SERVER_URL    Backend server URL (default: http://localhost:3000)
  TWINMCP_API_KEY       API key for authentication
  LOG_LEVEL            Logging level (debug, info, warn, error)
      `);
      process.exit(0);

    default:
      const server = new TwinMCPServer({
        logger,
      });

      try {
        await server.run();
      } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
      }
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
