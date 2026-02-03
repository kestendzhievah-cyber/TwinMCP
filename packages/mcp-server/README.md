# @twinmcp/mcp

> Up-to-date documentation and code snippets for any library via Model Context Protocol (MCP)

[![npm version](https://badge.fury.io/js/%40twinmcp%2Fmcp.svg)](https://www.npmjs.com/package/@twinmcp/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TwinMCP is an MCP server that provides IDE/LLM assistants with up-to-date documentation and code snippets for any library. Compatible with **Cursor**, **Claude Code**, **OpenCode**, and other MCP clients.

## Features

- 🔍 **Library Resolution** - Find library IDs from human-readable names
- 📚 **Documentation Search** - Get relevant code snippets and guides
- 🔄 **Always Up-to-date** - Documentation crawled and indexed regularly
- 🔐 **Secure** - API key or OAuth 2.0 authentication
- ⚡ **Fast** - Optimized for interactive IDE usage (<1-2s response time)
- 🌐 **Multi-tenant SaaS** - Rate limiting and quotas per plan

## Installation

### Via npx (Recommended)

```bash
npx -y @twinmcp/mcp --api-key YOUR_API_KEY
```

### Global Install

```bash
npm install -g @twinmcp/mcp
twinmcp --api-key YOUR_API_KEY
```

## IDE Integration

### Cursor

**Remote Server (Recommended)**

Add to `~/.cursor/mcp.json`:

```json
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
```

**Local Server**

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

### Claude Code

**Local**

```bash
claude mcp add twinmcp -- npx -y @twinmcp/mcp --api-key YOUR_API_KEY
```

**Remote HTTP**

```bash
claude mcp add --transport http twinmcp https://api.twinmcp.com/mcp \
  --header "TWINMCP_API_KEY: YOUR_API_KEY"
```

**OAuth**

```bash
claude mcp add --transport http twinmcp https://api.twinmcp.com/mcp/oauth
```

### OpenCode

Add to your OpenCode configuration:

**Remote**

```json
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
```

**Local**

```json
{
  "mcp": {
    "twinmcp": {
      "type": "local",
      "command": ["npx", "-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"],
      "enabled": true
    }
  }
}
```

## MCP Tools

### `resolve-library-id`

Resolve library names and find matching software libraries.

**Input:**
- `query` (string, required): User question or task
- `libraryName` (string, required): Human name of the library (e.g., "Supabase", "Next.js", "MongoDB")

**Output:**
- `libraryId`: TwinMCP ID in format `/vendor/lib`
- `name`: Full library name
- `description`: Library description
- `repo`: GitHub repository URL
- `defaultVersion`: Latest version
- `popularity`: Popularity score

### `query-docs`

Search documentation for a specific library.

**Input:**
- `libraryId` (string, required): TwinMCP library ID (e.g., `/mongodb/docs`)
- `query` (string, required): Question or task (setup, code example, configuration)
- `version` (string, optional): Specific version
- `maxResults` (number, optional): Max results (default: 10)
- `maxTokens` (number, optional): Max tokens in response (default: 4000)

**Output:**
- `results`: Array of documentation snippets with:
  - `type`: snippet | guide | api_ref
  - `title`: Document title
  - `content`: Markdown content
  - `url`: Source URL
  - `relevanceScore`: Relevance score (0-1)

## Usage Examples

### In Cursor/Claude

Add this rule to your AI assistant:

> "Always use TwinMCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask."

### Force Specific Library

Use the slash syntax to bypass resolution:

```
use library /vercel/next.js How do I set up middleware?
```

### Version-Specific Queries

```
How do I set up Next.js 14 middleware?
```

TwinMCP automatically resolves the version and returns v14-specific docs.

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/mcp` | API Key | Main MCP endpoint |
| `POST /api/mcp/oauth` | OAuth 2.0 | OAuth-authenticated MCP |
| `GET /api/libraries` | Public | Browse library catalog |
| `GET /api/mcp/health` | Public | Health check |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TWINMCP_API_KEY` | API key for authentication | - |
| `TWINMCP_SERVER_URL` | Backend server URL | `https://api.twinmcp.com` |
| `LOG_LEVEL` | Logging level | `info` |

## Rate Limits

| Plan | Requests/day | Tokens/response |
|------|--------------|-----------------|
| Free | 100 | 4,000 |
| Professional | 10,000 | 8,000 |
| Enterprise | Unlimited | Unlimited |

## Supported Libraries

TwinMCP supports 500+ popular libraries including:

- **JavaScript/TypeScript**: React, Next.js, Vue, Angular, Express, Fastify
- **Python**: Django, FastAPI, Flask, NumPy, Pandas
- **Databases**: MongoDB, PostgreSQL, MySQL, Redis, Prisma, Supabase
- **Cloud**: AWS SDK, GCP, Azure, Vercel, Netlify
- **And many more...**

Browse the full catalog at [twinmcp.com/libraries](https://twinmcp.com/libraries)

## Getting an API Key

1. Sign up at [twinmcp.com](https://twinmcp.com)
2. Go to Dashboard → API Keys
3. Create a new API key
4. Copy and use in your IDE configuration

## License

MIT © TwinMCP Team

## Links

- [Website](https://twinmcp.com)
- [Documentation](https://twinmcp.com/docs)
- [API Reference](https://twinmcp.com/docs/api)
- [GitHub](https://github.com/twinmcp/twinmcp)
- [Discord](https://discord.gg/twinmcp)
