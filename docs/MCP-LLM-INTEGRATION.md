# TwinMCP — LLM Integration Guide

Connect your TwinMCP server to any MCP-compatible LLM client.

## Prerequisites

1. Get your API key at: `https://twinmcp.com/dashboard/api-keys`
2. Your TwinMCP server is running at `https://YOUR_DOMAIN` (or `http://localhost:3000` for local dev)

## Available Transports

| Transport | Endpoint | Protocol | Used by |
|-----------|----------|----------|---------|
| **Streamable HTTP** | `POST /api/mcp` | JSON-RPC 2.0 over HTTP | Claude Code, OpenAI, Gemini, any modern client |
| **SSE** | `GET /api/mcp/sse` | Server-Sent Events | Claude Desktop, Cursor, Windsurf (legacy) |
| **stdio** | `npx @twinmcp/mcp` | stdin/stdout JSON-RPC | Claude Desktop, Cursor, Windsurf, VS Code |

---

## 1. Claude Desktop

### Option A: Local stdio (recommended)

Add to `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### Option B: Remote HTTP

```json
{
  "mcpServers": {
    "twinmcp": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

---

## 2. Claude Code (CLI)

### Local stdio
```bash
claude mcp add twinmcp -- npx -y @twinmcp/mcp --api-key YOUR_API_KEY
```

### Remote HTTP
```bash
claude mcp add --transport http twinmcp https://YOUR_DOMAIN/api/mcp \
  --header "X-API-Key: YOUR_API_KEY"
```

---

## 3. Cursor

Add to `~/.cursor/mcp.json`:

### Option A: Local stdio
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

### Option B: Remote HTTP
```json
{
  "mcpServers": {
    "twinmcp": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

---

## 4. Windsurf (Codeium)

Add to `~/.codeium/windsurf/mcp_config.json`:

### Option A: Local stdio
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

### Option B: Remote HTTP
```json
{
  "mcpServers": {
    "twinmcp": {
      "serverUrl": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

---

## 5. VS Code (GitHub Copilot / Continue)

Add to `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "twinmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

Or for HTTP transport in `settings.json`:
```json
{
  "mcp.servers": {
    "twinmcp": {
      "type": "http",
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

---

## 6. OpenAI (GPTs / Custom Actions)

OpenAI GPTs can call MCP servers via HTTP. Configure as a custom action:

**Endpoint:** `POST https://YOUR_DOMAIN/api/mcp`

**Headers:**
```
Content-Type: application/json
X-API-Key: YOUR_API_KEY
```

**Example request (list tools):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Example request (call a tool):**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "query-docs",
    "arguments": {
      "libraryId": "/vercel/next.js",
      "query": "How to setup middleware in Next.js 15?"
    }
  }
}
```

---

## 7. Google Gemini

Gemini supports MCP via HTTP. Use the Streamable HTTP endpoint:

```
POST https://YOUR_DOMAIN/api/mcp
Headers: X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

Same JSON-RPC format as OpenAI above.

---

## 8. OpenCode

Add to your opencode configuration:

```json
{
  "mcp": {
    "twinmcp": {
      "type": "remote",
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      },
      "enabled": true
    }
  }
}
```

---

## 9. Any HTTP Client (cURL example)

### Initialize
```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"curl","version":"1.0"}}}'
```

### List tools
```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

### Call a tool
```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"resolve-library-id","arguments":{"query":"How to use React hooks?","libraryName":"React"}}}'
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `resolve-library-id` | Find a library by name. Returns the TwinMCP library ID needed by `query-docs`. |
| `query-docs` | Search documentation for a library. Returns code snippets, guides, and API references. |

---

## Authentication

All requests require an API key via one of:
- `X-API-Key` header (recommended)
- `Authorization: Bearer YOUR_API_KEY` header
- `TWINMCP_API_KEY` header

## Rate Limits

| Plan | Daily Limit |
|------|-------------|
| Free | 200 requests |
| Pro | 10,000 requests |
| Enterprise | 100,000 requests |

Response headers include `X-RateLimit-Remaining` with current usage.

## Protocol

- **Version:** 2025-03-26
- **Transport:** Streamable HTTP (JSON response mode)
- **Format:** JSON-RPC 2.0
- All JSON-RPC errors return HTTP 200 with error in the response body
- Notifications (no `id`) return HTTP 204
