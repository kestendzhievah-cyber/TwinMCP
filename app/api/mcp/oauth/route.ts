import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'twinmcp-oauth-secret';
const OAUTH_CLIENT_ID = process.env.TWINMCP_OAUTH_CLIENT_ID || 'twinmcp-mcp-client';

// OAuth 2.0 token validation
async function validateOAuthToken(token: string): Promise<{ valid: boolean; userId?: string; plan?: string }> {
  if (!token) return { valid: false };
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; scope: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) return { valid: false };
    
    return {
      valid: true,
      userId: user.id,
      plan: (user as any).plan || 'free'
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
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message: 'OAuth token required',
        data: { 
          hint: 'Use OAuth 2.0 flow to obtain access token',
          authorizationEndpoint: '/api/auth/oauth/authorize',
          tokenEndpoint: '/api/auth/oauth/token'
        }
      }
    }, { status: 401 });
  }
  
  const auth = await validateOAuthToken(token);
  
  if (!auth.valid) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message: 'Invalid or expired OAuth token',
        data: { hint: 'Refresh your token or re-authenticate' }
      }
    }, { status: 401 });
  }
  
  // Forward to main MCP handler logic
  // In production, this would share the same handler code
  try {
    const body = await request.json();
    
    // Validate JSON-RPC format
    if (body.jsonrpc !== '2.0' || !body.method) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      }, { status: 400 });
    }
    
    // Handle MCP methods
    let result: unknown;
    
    switch (body.method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'twinmcp-server',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
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
                  libraryName: { type: 'string', description: 'Library name to search' }
                },
                required: ['query', 'libraryName']
              }
            },
            {
              name: 'query-docs',
              description: 'Search documentation for a specific library',
              inputSchema: {
                type: 'object',
                properties: {
                  libraryId: { type: 'string', description: 'TwinMCP library ID' },
                  query: { type: 'string', description: 'Documentation query' }
                },
                required: ['libraryId', 'query']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        // Proxy to main MCP endpoint for tool execution
        const mcpResponse = await fetch(new URL('/api/mcp', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TWINMCP_API_KEY': auth.userId! // Use userId as internal auth
          },
          body: JSON.stringify(body)
        });
        
        const mcpResult = await mcpResponse.json();
        return NextResponse.json(mcpResult, {
          headers: {
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Auth-Method': 'oauth'
          }
        });
        
      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`
          }
        }, { status: 400 });
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result
    }, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Auth-Method': 'oauth'
      }
    });
    
  } catch (error) {
    console.error('MCP OAuth Error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    }, { status: 500 });
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
      scopes: ['mcp:read', 'mcp:write']
    },
    supportedClients: ['claude-code', 'cursor'],
    documentation: 'https://twinmcp.com/docs/oauth'
  });
}
