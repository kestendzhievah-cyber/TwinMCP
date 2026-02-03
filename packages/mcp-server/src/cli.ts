#!/usr/bin/env node

import { TwinMCPServer } from './server';
import { MCPLogger } from './utils/logger';

async function main() {
  const logger = MCPLogger.create('TwinMCP-CLI');

  const args = process.argv.slice(2);
  
  // Parse arguments
  let apiKey = process.env['TWINMCP_API_KEY'] || '';
  let serverUrl = process.env['TWINMCP_SERVER_URL'] || 'https://api.twinmcp.com';
  let command = '';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (arg === '--server-url' && args[i + 1]) {
      serverUrl = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      command = 'help';
    } else if (arg === '--version' || arg === '-v') {
      command = 'version';
    } else if (!arg.startsWith('--')) {
      command = arg;
    }
  }

  switch (command) {
    case 'version':
      console.log('TwinMCP Server v1.0.0');
      console.log('MCP Protocol: 2024-11-05');
      process.exit(0);

    case 'help':
      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                       TwinMCP Server                              ║
║   Documentation and code snippets for any library via MCP         ║
╚═══════════════════════════════════════════════════════════════════╝

USAGE:
  npx @twinmcp/mcp [options]         Start MCP server (stdio mode)
  npx @twinmcp/mcp --api-key KEY     Start with API key
  npx @twinmcp/mcp version           Show version
  npx @twinmcp/mcp help              Show this help

OPTIONS:
  --api-key KEY      TwinMCP API key for authentication
  --server-url URL   Backend server URL (default: https://api.twinmcp.com)
  -v, --version      Show version
  -h, --help         Show help

ENVIRONMENT VARIABLES:
  TWINMCP_API_KEY       API key for authentication
  TWINMCP_SERVER_URL    Backend server URL
  LOG_LEVEL             Logging level (debug, info, warn, error)

CURSOR INTEGRATION:
  Add to ~/.cursor/mcp.json:
  {
    "mcpServers": {
      "twinmcp": {
        "command": "npx",
        "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
      }
    }
  }

  Or for remote connection:
  {
    "mcpServers": {
      "twinmcp": {
        "url": "https://api.twinmcp.com/mcp",
        "headers": {
          "TWINMCP_API_KEY": "YOUR_API_KEY"
        }
      }
    }
  }

CLAUDE CODE INTEGRATION:
  Local:
    claude mcp add twinmcp -- npx -y @twinmcp/mcp --api-key YOUR_API_KEY
  
  Remote HTTP:
    claude mcp add --transport http twinmcp https://api.twinmcp.com/mcp \\
      --header "TWINMCP_API_KEY: YOUR_API_KEY"
  
  OAuth:
    claude mcp add --transport http twinmcp https://api.twinmcp.com/mcp/oauth

OPENCODE INTEGRATION:
  Add to opencode config:
  {
    "mcp": {
      "twinmcp": {
        "type": "remote",
        "url": "https://api.twinmcp.com/mcp",
        "headers": {
          "TWINMCP_API_KEY": "YOUR_API_KEY"
        },
        "enabled": true
      }
    }
  }

MCP TOOLS:
  resolve-library-id   Find library ID from name
  query-docs           Search documentation for a library

EXAMPLES:
  # Start local MCP server
  npx @twinmcp/mcp --api-key sk_live_xxx

  # Use in prompt with "use twinmcp"
  "use twinmcp How do I set up Next.js 14 middleware?"

  # Force specific library
  "use library /vercel/next.js Show me the App Router docs"

Get your API key at: https://twinmcp.com/dashboard/api-keys
Documentation: https://twinmcp.com/docs
      `);
      process.exit(0);

    default:
      // Validate API key is provided
      if (!apiKey) {
        logger.warn('No API key provided. Get one at https://twinmcp.com/dashboard/api-keys');
        logger.info('Some features may be limited without an API key.');
      }
      
      const server = new TwinMCPServer({
        config: {
          apiKey,
          serverUrl,
        },
        logger,
      });

      try {
        logger.info('Starting TwinMCP MCP Server...');
        logger.info(`Server URL: ${serverUrl}`);
        logger.info('API Key: ' + (apiKey ? '****' + apiKey.slice(-4) : 'not provided'));
        
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

export { main };