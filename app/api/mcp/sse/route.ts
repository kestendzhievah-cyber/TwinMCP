/**
 * /api/mcp/sse — Legacy SSE transport for MCP clients.
 *
 * GET  /api/mcp/sse          → Opens SSE stream, sends "endpoint" event
 * POST /api/mcp/sse          → Receives JSON-RPC messages for a session
 *
 * Used by: Claude Desktop, Cursor, Windsurf (legacy SSE transport).
 * Newer clients should use POST /api/mcp (Streamable HTTP transport).
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit } from '@/lib/mcp/mcp-server';

// ---------------------------------------------------------------------------
// In-memory session store for SSE connections
// ---------------------------------------------------------------------------

interface SSESession {
  controller: ReadableStreamDefaultController;
  createdAt: number;
  lastActivity: number;
  userId: string;
  plan: string;
}

const sseSessions = new Map<string, SSESession>();

// Cleanup stale sessions every 60 seconds
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sseSessions) {
      if (now - session.lastActivity > 300_000) {
        // 5 minutes timeout
        try {
          session.controller.close();
        } catch {
          /* ok */
        }
        sseSessions.delete(id);
      }
    }
  }, 60_000);
  if (cleanupInterval.unref) cleanupInterval.unref();
}

// ---------------------------------------------------------------------------
// Helper: send SSE event
// ---------------------------------------------------------------------------

function sendSSE(controller: ReadableStreamDefaultController, event: string, data: string) {
  try {
    const encoder = new TextEncoder();
    const lines = data.split('\n');
    let payload = `event: ${event}\n`;
    for (const line of lines) {
      payload += `data: ${line}\n`;
    }
    payload += '\n';
    controller.enqueue(encoder.encode(payload));
  } catch {
    // Stream may have been closed
  }
}

// ---------------------------------------------------------------------------
// Helper: generate session ID
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return `sse_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 11)}`;
}

// ---------------------------------------------------------------------------
// Auth helper (shared with main route)
// ---------------------------------------------------------------------------

async function authenticateRequest(request: NextRequest) {
  const apiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('twinmcp_api_key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    new URL(request.url).searchParams.get('api_key') || // Allow query param for SSE (browser limitation)
    '';

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) return null;

  const rl = await checkRateLimit(auth.userId!, auth.plan!);
  if (!rl.allowed) return null;

  return { userId: auth.userId!, plan: auth.plan! };
}

// ---------------------------------------------------------------------------
// Lazy tool execution (same as main /api/mcp route)
// ---------------------------------------------------------------------------

let _libraryService: any = null;
let _vectorService: any = null;
let _servicesReady = false;

async function ensureServices() {
  if (_servicesReady) return;
  _servicesReady = true;
  try {
    const { prisma } = await import('@/lib/prisma');
    let redis: any = null;
    try {
      redis = (await import('@/lib/redis')).redis;
    } catch {
      /* ok */
    }
    try {
      const { LibraryResolutionService } =
        await import('@/lib/services/library-resolution.service');
      _libraryService = new LibraryResolutionService(prisma, redis);
    } catch {
      /* ok */
    }
    try {
      const { VectorSearchService } = await import('@/lib/services/vector-search.service');
      _vectorService = new VectorSearchService(prisma, redis);
    } catch {
      /* ok */
    }
  } catch {
    _servicesReady = false;
  }
}

async function executeTool(toolName: string, toolArgs: any): Promise<any> {
  await ensureServices();

  if (toolName === 'resolve-library-id') {
    if (_libraryService) {
      return _libraryService.resolveLibrary({
        query: toolArgs.libraryName,
        context: {},
        limit: 5,
        include_aliases: true,
      });
    }
    return { results: [], totalFound: 0, query: toolArgs.libraryName };
  }

  if (toolName === 'query-docs') {
    if (_vectorService) {
      return _vectorService.searchDocuments({
        library_id: toolArgs.libraryId,
        query: toolArgs.query,
        version: toolArgs.version,
        max_results: toolArgs.maxResults || 10,
        include_code: true,
        context_limit: toolArgs.maxTokens || 4000,
      });
    }
    return {
      libraryId: toolArgs.libraryId,
      query: toolArgs.query,
      results: [],
      totalResults: 0,
      totalTokens: 0,
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------

const MCP_TOOLS = [
  {
    name: 'resolve-library-id',
    description:
      'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User question or task to help contextualise the search',
        },
        libraryName: {
          type: 'string',
          description: 'Human name of the library (e.g. "React", "Next.js", "MongoDB")',
        },
      },
      required: ['query', 'libraryName'],
    },
  },
  {
    name: 'query-docs',
    description:
      'Search documentation for a specific library. Returns code snippets, guides, and API references optimised for LLM context.',
    inputSchema: {
      type: 'object',
      properties: {
        libraryId: {
          type: 'string',
          description:
            'TwinMCP library ID in format /vendor/lib (e.g. /mongodb/docs, /vercel/next.js)',
        },
        query: {
          type: 'string',
          description: 'Question or task (setup, code example, configuration, etc.)',
        },
        version: { type: 'string', description: 'Optional specific version of the library' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
        maxTokens: { type: 'number', description: 'Maximum tokens in response (default: 4000)' },
      },
      required: ['libraryId', 'query'],
    },
  },
];

// ---------------------------------------------------------------------------
// Process a JSON-RPC message and return the response
// ---------------------------------------------------------------------------

async function processMessage(message: any): Promise<any> {
  const id = message?.id ?? null;

  if (message?.jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
  }

  switch (message.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'twinmcp-server', version: '1.0.0' },
          capabilities: { tools: { listChanged: false }, logging: {} },
        },
      };

    case 'notifications/initialized':
      return null; // No response for notifications

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };

    case 'tools/call': {
      const { name: toolName, arguments: toolArgs } = message.params ?? {};
      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: tool name required' },
        };
      }
      try {
        const result = await executeTool(toolName, toolArgs ?? {});
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
        };
      }
    }

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      if (id === null || id === undefined) return null; // Notification — no response
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${message.method}` },
      };
  }
}

// ---------------------------------------------------------------------------
// GET /api/mcp/sse — Open SSE stream
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  ensureCleanup();
  const sessionId = generateSessionId();

  const stream = new ReadableStream({
    start(controller) {
      const session: SSESession = {
        controller,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        userId: auth.userId,
        plan: auth.plan,
      };
      sseSessions.set(sessionId, session);

      // Send the endpoint event — tells the client where to POST messages
      const messageUrl = `/api/mcp/sse?sessionId=${sessionId}`;
      sendSSE(controller, 'endpoint', messageUrl);

      // Keep-alive ping every 30 seconds
      const pingTimer = setInterval(() => {
        if (!sseSessions.has(sessionId)) {
          clearInterval(pingTimer);
          return;
        }
        sendSSE(controller, 'ping', String(Date.now()));
      }, 30_000);

      // Cleanup when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(pingTimer);
        sseSessions.delete(sessionId);
        try {
          controller.close();
        } catch {
          /* ok */
        }
      });
    },
    cancel() {
      sseSessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/mcp/sse — Receive JSON-RPC messages for an SSE session
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId || !sseSessions.has(sessionId)) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Invalid or missing sessionId' },
      },
      { status: 400 }
    );
  }

  const session = sseSessions.get(sessionId)!;
  session.lastActivity = Date.now();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 200 }
    );
  }

  // Acknowledge receipt immediately
  // Process asynchronously and push response through SSE
  const processAndSend = async () => {
    try {
      const response = await processMessage(body);
      if (response) {
        sendSSE(session.controller, 'message', JSON.stringify(response));
      }
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: body?.id ?? null,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error),
        },
      };
      sendSSE(session.controller, 'message', JSON.stringify(errorResponse));
    }
  };

  // Fire and forget
  processAndSend().catch(err => {
    logger.error('[MCP SSE] Error processing message:', err);
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
