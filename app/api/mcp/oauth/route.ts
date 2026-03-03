import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

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

// OAuth 2.0 MCP endpoint - same functionality as /api/mcp but with OAuth auth
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Extract OAuth token from Authorization header
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'OAuth token required',
          data: {
            hint: 'Use OAuth 2.0 flow to obtain access token',
            authorizationEndpoint: '/api/auth/oauth/authorize',
            tokenEndpoint: '/api/auth/oauth/token',
          },
        },
      },
      { status: 401 }
    );
  }

  const auth = await validateOAuthToken(token);

  if (!auth.valid) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Invalid or expired OAuth token',
          data: { hint: 'Refresh your token or re-authenticate' },
        },
      },
      { status: 401 }
    );
  }

  // Forward to main MCP handler logic
  // In production, this would share the same handler code
  try {
    const body = await request.json();

    // Validate JSON-RPC format
    if (body.jsonrpc !== '2.0' || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body.id || null,
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
        },
        { status: 400 }
      );
    }

    // Handle MCP methods
    let result: unknown;

    switch (body.method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'twinmcp-server',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        };
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: 'resolve-library-id',
              description: 'Resolve library names and find matching software libraries',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'User question or task' },
                  libraryName: { type: 'string', description: 'Library name to search' },
                },
                required: ['query', 'libraryName'],
              },
            },
            {
              name: 'query-docs',
              description: 'Search documentation for a specific library',
              inputSchema: {
                type: 'object',
                properties: {
                  libraryId: { type: 'string', description: 'TwinMCP library ID' },
                  query: { type: 'string', description: 'Documentation query' },
                },
                required: ['libraryId', 'query'],
              },
            },
          ],
        };
        break;

      case 'tools/call': {
        // Execute tool directly using the same logic as /api/mcp
        const { name: toolName, arguments: toolArgs } = body.params ?? {};

        if (!toolName) {
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32602, message: 'Invalid params: tool name required' },
            },
            {
              status: 200,
              headers: {
                'X-Response-Time': `${Date.now() - startTime}ms`,
                'X-Auth-Method': 'oauth',
              },
            }
          );
        }

        let toolResult: any;

        if (toolName === 'resolve-library-id') {
          try {
            const { getServices } = await import('@/lib/mcp-tools');
            const { libraryResolutionService } = await getServices();
            if (libraryResolutionService) {
              toolResult = await libraryResolutionService.resolveLibrary({
                query: toolArgs?.libraryName,
                context: {},
                limit: 5,
                include_aliases: true,
              });
            } else {
              toolResult = { results: [], totalFound: 0, query: toolArgs?.libraryName };
            }
          } catch {
            toolResult = { results: [], totalFound: 0, query: toolArgs?.libraryName };
          }
        } else if (toolName === 'query-docs') {
          try {
            const { getServices } = await import('@/lib/mcp-tools');
            const { vectorSearchService } = await getServices();
            if (vectorSearchService) {
              toolResult = await vectorSearchService.searchDocuments({
                library_id: toolArgs?.libraryId,
                query: toolArgs?.query,
                version: toolArgs?.version,
                max_results: toolArgs?.maxResults || 10,
                include_code: true,
                context_limit: toolArgs?.maxTokens || 4000,
              });
            } else {
              toolResult = {
                libraryId: toolArgs?.libraryId,
                query: toolArgs?.query,
                results: [],
                totalResults: 0,
                totalTokens: 0,
              };
            }
          } catch {
            toolResult = {
              libraryId: toolArgs?.libraryId,
              query: toolArgs?.query,
              results: [],
              totalResults: 0,
              totalTokens: 0,
            };
          }
        } else {
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32601, message: `Unknown tool: ${toolName}` },
            },
            {
              status: 200,
              headers: {
                'X-Response-Time': `${Date.now() - startTime}ms`,
                'X-Auth-Method': 'oauth',
              },
            }
          );
        }

        result = { content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }] };
        break;
      }

      default:
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`,
            },
          },
          { status: 400 }
        );
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: body.id,
        result,
      },
      {
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Auth-Method': 'oauth',
        },
      }
    );
  } catch (error) {
    logger.error('MCP OAuth Error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
        },
      },
      { status: 500 }
    );
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
