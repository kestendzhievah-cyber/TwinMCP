# @twinmcp/mcp

TwinMCP MCP Server - Documentation and code snippets for any library, powered by the Model Context Protocol.

## Installation

```bash
npm install @twinmcp/mcp
```

## Usage

### As MCP Server (stdio)

```bash
npx @twinmcp/mcp
```

### Programmatic Usage

```typescript
import { TwinMCPServer, TwinMCPClient } from '@twinmcp/mcp';

// Start MCP server
const server = new TwinMCPServer();
await server.run();

// Use client directly
const client = new TwinMCPClient({
  serverUrl: 'https://api.twinmcp.com',
  apiKey: 'your-api-key',
});

// Resolve a library
const library = await client.resolveLibrary({
  query: 'How do I set up MongoDB authentication?'
});

// Query documentation
const docs = await client.queryDocs({
  libraryId: '/mongodb/docs',
  query: 'connection pooling examples'
});
```

## Available Tools

### resolve-library-id

Resolve a library name or query to a canonical library identifier.

**Parameters:**
- `query` (required): Natural language query describing the library or functionality needed
- `libraryName` (optional): Specific library name to search for
- `version` (optional): Specific version of the library

### query-docs

Search documentation for a specific library using natural language queries.

**Parameters:**
- `libraryId` (required): The canonical library identifier (e.g., /mongodb/docs)
- `query` (required): Natural language query for searching documentation
- `version` (optional): Specific version of the library
- `contentType` (optional): Filter results by content type ('snippet', 'guide', 'api_ref')
- `maxResults` (optional): Maximum number of results to return (default: 10)
- `maxTokens` (optional): Maximum total tokens in response (default: 4000)

## Configuration

The server can be configured using environment variables:

- `TWINMCP_SERVER_URL`: Backend server URL (default: http://localhost:3000)
- `TWINMCP_API_KEY`: API key for authentication
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Start development server
npm run dev

# Run CLI
npm run cli -- help
```

## License

MIT
