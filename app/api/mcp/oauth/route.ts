import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { trackUsage } from '@/lib/mcp/mcp-server';
import { handleApiError } from '@/lib/api-error-handler';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret || 'dev-only-secret-not-for-production';
}
const OAUTH_CLIENT_ID = process.env.TWINMCP_OAUTH_CLIENT_ID || 'twinmcp-mcp-client';

// OAuth 2.0 token validation
async function validateOAuthToken(
  token: string
): Promise<{ valid: boolean; userId?: string; plan?: string }> {
  if (!token) return { valid: false };

  try {
    const jwtModule = await import('jsonwebtoken');
    const decoded = jwtModule.default.verify(token, getJwtSecret()) as {
      userId: string;
      scope: string;
    };

    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) return { valid: false };

    return {
      valid: true,
      userId: user.id,
      plan: (user as any).plan || 'free',
    };
  } catch {
    return { valid: false };
  }
}

// ---------------------------------------------------------------------------
// Lazy services (shared pattern with /api/mcp)
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
    } catch { /* ok */ }

    try {
      const { LibraryResolutionService } =
        await import('@/lib/services/library-resolution.service');
      _libraryService = new LibraryResolutionService(prisma, redis);
    } catch { /* ok */ }

    try {
      const { VectorSearchService } = await import('@/lib/services/vector-search.service');
      _vectorService = new VectorSearchService(prisma, redis);
    } catch { /* ok */ }
  } catch {
    _servicesReady = false;
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC helper
// ---------------------------------------------------------------------------

function jsonrpc(id: any, result?: any, error?: { code: number; message: string; data?: any }) {
  const msg: any = { jsonrpc: '2.0', id: id ?? null };
  if (error) msg.error = error;
  else msg.result = result;
  return msg;
}

// ---------------------------------------------------------------------------
// MCP Tool definitions (single source — matches /api/mcp)
// ---------------------------------------------------------------------------

const MCP_TOOLS = [
  {
    name: 'resolve-library-id',
    description:
      'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'User question or task to help contextualise the search' },
        libraryName: { type: 'string', description: 'Human name of the library (e.g. "React", "Next.js", "MongoDB")' },
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
        libraryId: { type: 'string', description: 'TwinMCP library ID in format /vendor/lib (e.g. /mongodb/docs, /vercel/next.js)' },
        query: { type: 'string', description: 'Question or task (setup, code example, configuration, etc.)' },
        version: { type: 'string', description: 'Optional specific version of the library' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
        maxTokens: { type: 'number', description: 'Maximum tokens in response (default: 4000)' },
      },
      required: ['libraryId', 'query'],
    },
    annotations: { title: 'Query Documentation', readOnlyHint: true, openWorldHint: true },
  },
];

// OAuth 2.0 MCP endpoint - same functionality as /api/mcp but with OAuth auth
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Extract OAuth token from Authorization header
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      jsonrpc(null, undefined, {
        code: -32001,
        message: 'OAuth token required',
        data: {
          hint: 'Use OAuth 2.0 flow to obtain access token',
          authorizationEndpoint: '/api/auth/oauth/authorize',
          tokenEndpoint: '/api/auth/oauth/token',
        },
      }),
      { status: 401 }
    );
  }

  const auth = await validateOAuthToken(token);

  if (!auth.valid) {
    return NextResponse.json(
      jsonrpc(null, undefined, {
        code: -32001,
        message: 'Invalid or expired OAuth token',
        data: { hint: 'Refresh your token or re-authenticate' },
      }),
      { status: 401 }
    );
  }

  const userId = auth.userId || 'unknown';
  const hdrs = { 'X-Auth-Method': 'oauth' };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      jsonrpc(null, undefined, { code: -32700, message: 'Parse error' }),
      { status: 200 }
    );
  }

  const id = body?.id ?? null;

  // Validate JSON-RPC format
  if (body?.jsonrpc !== '2.0') {
    return NextResponse.json(
      jsonrpc(id, undefined, { code: -32600, message: 'Invalid Request — expected JSON-RPC 2.0' }),
      { status: 200, headers: hdrs }
    );
  }

  const method: string = body.method;
  const params: any = body.params;

  try {
    switch (method) {
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

      case 'notifications/initialized': {
        return new NextResponse(null, { status: 204 });
      }

      case 'tools/list': {
        return NextResponse.json(
          jsonrpc(id, { tools: MCP_TOOLS }),
          { status: 200, headers: hdrs }
        );
      }

      case 'tools/call': {
        const toolName: string | undefined = params?.name;
        const toolArgs: any = params?.arguments ?? {};

        if (!toolName) {
          return NextResponse.json(
            jsonrpc(id, undefined, { code: -32602, message: 'Invalid params: tool name required' }),
            { status: 200, headers: hdrs }
          );
        }

        await ensureServices();

        if (toolName === 'resolve-library-id') {
          if (!toolArgs.query || !toolArgs.libraryName) {
            return NextResponse.json(
              jsonrpc(id, undefined, { code: -32602, message: 'Invalid params: query and libraryName required' }),
              { status: 200, headers: hdrs }
            );
          }
          const toolStart = Date.now();
          let result: any;
          if (_libraryService) {
            result = await _libraryService.resolveLibrary({
              query: toolArgs.libraryName,
              context: {},
              limit: 5,
              include_aliases: true,
            });
          } else {
            result = { results: [], totalFound: 0, query: toolArgs.libraryName,
              _note: 'LibraryResolutionService not available.' };
          }
          trackUsage(userId, 'resolve-library-id', 50, Date.now() - toolStart);
          return NextResponse.json(
            jsonrpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }),
            { status: 200, headers: hdrs }
          );
        }

        if (toolName === 'query-docs') {
          if (!toolArgs.libraryId || !toolArgs.query) {
            return NextResponse.json(
              jsonrpc(id, undefined, { code: -32602, message: 'Invalid params: libraryId and query required' }),
              { status: 200, headers: hdrs }
            );
          }
          const toolStart = Date.now();
          let result: any;
          if (_vectorService) {
            result = await _vectorService.searchDocuments({
              library_id: toolArgs.libraryId,
              query: toolArgs.query,
              version: toolArgs.version,
              max_results: toolArgs.maxResults || 10,
              include_code: true,
              context_limit: toolArgs.maxTokens || 4000,
            });
          } else {
            result = { libraryId: toolArgs.libraryId, query: toolArgs.query, results: [],
              totalResults: 0, totalTokens: 0,
              _note: 'VectorSearchService not available.' };
          }
          trackUsage(userId, 'query-docs', (result as any).totalTokens || 100, Date.now() - toolStart);
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

      case 'ping': {
        return NextResponse.json(jsonrpc(id, {}), { status: 200, headers: hdrs });
      }

      default: {
        if (id === null || id === undefined) {
          return new NextResponse(null, { status: 204 });
        }
        return NextResponse.json(
          jsonrpc(id, undefined, {
            code: -32601,
            message: `Method not found: ${method}`,
          }),
          { status: 200, headers: hdrs }
        );
      }
    }
  } catch (error) {
    return handleApiError(error, 'McpOAuth');
  }
}

// GET - OAuth discovery endpoint
export async function GET() {
  return NextResponse.json({
    name: 'TwinMCP OAuth MCP Endpoint',
    version: '1.0.0',
    authMethod: 'oauth2',
    oauth: {
      clientId: OAUTH_CLIENT_ID,
      authorizationEndpoint: '/api/auth/oauth/authorize',
      tokenEndpoint: '/api/auth/oauth/token',
      scopes: ['mcp:read', 'mcp:write'],
    },
    supportedClients: ['claude-code', 'cursor'],
    documentation: 'https://twinmcp.com/docs/oauth',
  });
}
