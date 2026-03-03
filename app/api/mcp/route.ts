/**
 * /api/mcp — MCP JSON-RPC 2.0 endpoint.
 *
 * Implements the MCP protocol directly over HTTP POST (Streamable HTTP
 * transport, JSON-response mode). This is the most compatible approach
 * for LLM clients: Claude Desktop, Claude Code, Cursor, Windsurf,
 * VS Code Copilot, OpenAI GPTs, Gemini, and any MCP-compliant client.
 *
 * POST  → JSON-RPC request/response
 * GET   → Server discovery / health
 * DELETE → Session termination (spec compliance)
 *
 * Protocol version: 2025-03-26
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit } from '@/lib/mcp/mcp-server';

// ---------------------------------------------------------------------------
// Lazy services (same as mcp-server.ts singleton, kept in sync)
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

// ---------------------------------------------------------------------------
// Usage tracking (fire-and-forget)
// ---------------------------------------------------------------------------

function trackUsage(userId: string, tool: string, tokens: number) {
  import('@/lib/prisma')
    .then(({ prisma }) =>
      prisma.usageLog.create({
        data: { userId, toolName: tool, tokensReturned: tokens, success: true, responseTimeMs: 0 },
      })
    )
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// MCP Tool definitions (JSON Schema — spec-compliant)
// ---------------------------------------------------------------------------

const MCP_TOOLS = [
  {
    name: 'resolve-library-id',
    description:
      'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
    inputSchema: {
      type: 'object' as const,
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
    annotations: { title: 'Resolve Library ID', readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'query-docs',
    description:
      'Search documentation for a specific library. Returns code snippets, guides, and API references optimised for LLM context.',
    inputSchema: {
      type: 'object' as const,
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
    annotations: { title: 'Query Documentation', readOnlyHint: true, openWorldHint: true },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeResolveLibrary(args: any) {
  await ensureServices();
  if (_libraryService) {
    return _libraryService.resolveLibrary({
      query: args.libraryName,
      context: {},
      limit: 5,
      include_aliases: true,
    });
  }
  return {
    results: [],
    totalFound: 0,
    query: args.libraryName,
    _note:
      'LibraryResolutionService not available. Configure database for full library resolution.',
  };
}

async function executeQueryDocs(args: any) {
  await ensureServices();
  if (_vectorService) {
    return _vectorService.searchDocuments({
      library_id: args.libraryId,
      query: args.query,
      version: args.version,
      max_results: args.maxResults || 10,
      include_code: true,
      context_limit: args.maxTokens || 4000,
    });
  }
  return {
    libraryId: args.libraryId,
    query: args.query,
    results: [],
    totalResults: 0,
    totalTokens: 0,
    _note:
      'VectorSearchService not available. Configure database and vector store for full documentation search.',
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC helper
// ---------------------------------------------------------------------------

function jsonrpc(
  id: string | number | null,
  result?: unknown,
  error?: { code: number; message: string; data?: unknown }
) {
  const msg: any = { jsonrpc: '2.0' as const, id };
  if (error) msg.error = error;
  else msg.result = result;
  return msg;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function authenticateRequest(request: NextRequest) {
  const apiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('twinmcp_api_key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    '';

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return {
      ok: false as const,
      response: NextResponse.json(
        jsonrpc(null, undefined, {
          code: -32001,
          message: 'Invalid or missing API key',
          data: {
            hint: 'Provide API key via X-API-Key header, Authorization: Bearer <key>, or TWINMCP_API_KEY header',
          },
        }),
        { status: 401 }
      ),
    };
  }

  const rl = await checkRateLimit(auth.userId!, auth.plan!);
  if (!rl.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        jsonrpc(null, undefined, {
          code: -32002,
          message: 'Rate limit exceeded',
          data: { remaining: rl.remaining, plan: auth.plan },
        }),
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(rl.remaining),
            'X-RateLimit-Plan': auth.plan!,
          },
        }
      ),
    };
  }

  return { ok: true as const, userId: auth.userId!, plan: auth.plan!, remaining: rl.remaining };
}

// ---------------------------------------------------------------------------
// POST /api/mcp — MCP JSON-RPC endpoint
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.ok) return authResult.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonrpc(null, undefined, { code: -32700, message: 'Parse error' }), {
      status: 200,
    });
  }

  const id = body?.id ?? null;

  // JSON-RPC 2.0 validation
  if (body?.jsonrpc !== '2.0') {
    return NextResponse.json(
      jsonrpc(id, undefined, { code: -32600, message: 'Invalid Request — expected JSON-RPC 2.0' }),
      { status: 200 }
    );
  }

  const method: string = body.method;
  const params: any = body.params;

  const hdrs = {
    'Content-Type': 'application/json',
    'X-RateLimit-Remaining': String(authResult.remaining),
  };

  try {
    switch (method) {
      // ── initialize ───────────────────────────────────────────
      case 'initialize': {
        return NextResponse.json(
          jsonrpc(id, {
            protocolVersion: '2025-03-26',
            serverInfo: { name: 'twinmcp-server', version: '1.0.0' },
            capabilities: { tools: { listChanged: false }, logging: {} },
          }),
          { status: 200, headers: hdrs }
        );
      }

      // ── notifications/initialized (client acknowledgement) ──
      case 'notifications/initialized': {
        // Spec: server must accept this silently; it is a notification (no id)
        return new NextResponse(null, { status: 204 });
      }

      // ── tools/list ───────────────────────────────────────────
      case 'tools/list': {
        return NextResponse.json(jsonrpc(id, { tools: MCP_TOOLS }), { status: 200, headers: hdrs });
      }

      // ── tools/call ───────────────────────────────────────────
      case 'tools/call': {
        const toolName: string | undefined = params?.name;
        const toolArgs: any = params?.arguments ?? {};

        if (!toolName) {
          return NextResponse.json(
            jsonrpc(id, undefined, { code: -32602, message: 'Invalid params: tool name required' }),
            { status: 200, headers: hdrs }
          );
        }

        if (toolName === 'resolve-library-id') {
          if (!toolArgs.query || !toolArgs.libraryName) {
            return NextResponse.json(
              jsonrpc(id, undefined, {
                code: -32602,
                message: 'Invalid params: query and libraryName required',
              }),
              { status: 200, headers: hdrs }
            );
          }
          const result = await executeResolveLibrary(toolArgs);
          trackUsage(authResult.userId, 'resolve-library-id', 50);
          return NextResponse.json(
            jsonrpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }),
            { status: 200, headers: hdrs }
          );
        }

        if (toolName === 'query-docs') {
          if (!toolArgs.libraryId || !toolArgs.query) {
            return NextResponse.json(
              jsonrpc(id, undefined, {
                code: -32602,
                message: 'Invalid params: libraryId and query required',
              }),
              { status: 200, headers: hdrs }
            );
          }
          const result = await executeQueryDocs(toolArgs);
          trackUsage(authResult.userId, 'query-docs', (result as any).totalTokens || 100);
          return NextResponse.json(
            jsonrpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }),
            { status: 200, headers: hdrs }
          );
        }

        return NextResponse.json(
          jsonrpc(id, undefined, {
            code: -32601,
            message: `Unknown tool: ${toolName}`,
            data: { availableTools: MCP_TOOLS.map(t => t.name) },
          }),
          { status: 200, headers: hdrs }
        );
      }

      // ── ping ─────────────────────────────────────────────────
      case 'ping': {
        return NextResponse.json(jsonrpc(id, {}), { status: 200, headers: hdrs });
      }

      // ── unknown method ───────────────────────────────────────
      default: {
        // Notifications (no id) that we don't handle → silent 204
        if (id === null || id === undefined) {
          return new NextResponse(null, { status: 204 });
        }
        return NextResponse.json(
          jsonrpc(id, undefined, {
            code: -32601,
            message: `Method not found: ${method}`,
            data: {
              availableMethods: [
                'initialize',
                'notifications/initialized',
                'tools/list',
                'tools/call',
                'ping',
              ],
            },
          }),
          { status: 200, headers: hdrs }
        );
      }
    }
  } catch (error) {
    logger.error('[MCP] POST error:', error);
    return NextResponse.json(
      jsonrpc(id, undefined, {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : String(error),
      }),
      { status: 200, headers: hdrs }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/mcp — Server discovery / health
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    name: 'TwinMCP Server',
    version: '1.0.0',
    protocol: 'MCP 2025-03-26',
    description: 'MCP server providing documentation and code snippets for any library',
    transports: {
      streamableHttp: 'POST /api/mcp',
      sse: 'GET /api/mcp/sse',
    },
    tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    authentication: {
      type: 'API Key',
      headers: ['X-API-Key', 'Authorization: Bearer <key>', 'TWINMCP_API_KEY'],
    },
    llmConfigs: {
      cursorWindsurf: {
        url: 'https://YOUR_DOMAIN/api/mcp',
        headers: { TWINMCP_API_KEY: 'YOUR_API_KEY' },
      },
      claudeCode:
        'claude mcp add --transport http twinmcp https://YOUR_DOMAIN/api/mcp --header "X-API-Key: YOUR_API_KEY"',
      claudeDesktop: {
        mcpServers: {
          twinmcp: {
            command: 'npx',
            args: ['-y', '@twinmcp/mcp', '--api-key', 'YOUR_API_KEY'],
          },
        },
      },
    },
    documentation: 'https://twinmcp.com/docs',
    status: 'healthy',
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/mcp — Session termination (Streamable HTTP spec)
// ---------------------------------------------------------------------------

export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}
