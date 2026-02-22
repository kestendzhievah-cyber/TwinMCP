import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Lazy-init prisma to avoid DB connection at import time
async function db() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Tool schemas matching Context7 MCP spec
const ResolveLibraryIdSchema = z.object({
  query: z.string().min(1).max(500).describe('User question or task'),
  libraryName: z.string().min(1).max(200).describe('Human name of library (e.g., "Supabase", "Next.js", "MongoDB")'),
});

const QueryDocsSchema = z.object({
  libraryId: z.string().min(1).describe('TwinMCP library ID (e.g., /mongodb/docs, /vercel/next.js)'),
  query: z.string().min(1).max(1000).describe('Question or task (setup, code example, advanced config)'),
  version: z.string().optional().describe('Specific version of the library'),
  maxResults: z.number().min(1).max(50).default(10),
  maxTokens: z.number().min(100).max(8000).default(4000),
});

// Validate API Key
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; plan?: string }> {
  if (!apiKey) return { valid: false };
  
  try {
    const { createHash } = await import('crypto');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const prisma = await db();
    const key = await prisma.apiKey.findUnique({
      where: { keyHash }
    });
    
    if (!key || !key.isActive || key.revokedAt) return { valid: false };
    
    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() }
    });
    
    return {
      valid: true,
      userId: key.userId,
      plan: key.tier || 'free'
    };
  } catch {
    return { valid: false };
  }
}

// Rate limiting check
async function checkRateLimit(userId: string, plan: string): Promise<{ allowed: boolean; remaining: number }> {
  const limits: Record<string, number> = {
    free: 200,
    pro: 10000,
    enterprise: 100000
  };
  
  const limit = limits[plan] || limits.free;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  try {
    const prisma = await db();
    const usage = await prisma.usageLog.count({
      where: {
        userId,
        createdAt: { gte: dayStart }
      }
    });
    
    return {
      allowed: usage < limit,
      remaining: Math.max(0, limit - usage)
    };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

// Track API usage
async function trackUsage(userId: string, tool: string, tokens: number) {
  try {
    const prisma = await db();
    await prisma.usageLog.create({
      data: {
        userId,
        toolName: tool,
        tokensReturned: tokens,
        success: true,
        responseTimeMs: 0
      }
    });
  } catch (e) {
    logger.error('Failed to track usage:', e);
  }
}

// Use real services from lib/mcp-tools when available
async function resolveLibraryId(params: z.infer<typeof ResolveLibraryIdSchema>) {
  try {
    const { getServices } = await import('@/lib/mcp-tools');
    const { libraryResolutionService } = await getServices();
    if (libraryResolutionService) {
      const result = await libraryResolutionService.resolveLibrary({
        query: params.libraryName,
        context: {},
        limit: 5,
        include_aliases: true
      });
      return result;
    }
  } catch (error) {
    logger.warn('[MCP Route] LibraryResolutionService unavailable, using fallback:', error);
  }

  // Fallback: return empty results with guidance
  return {
    results: [],
    totalFound: 0,
    query: params.libraryName,
    _note: 'LibraryResolutionService not available. Configure database for full library resolution.'
  };
}

async function queryDocs(params: z.infer<typeof QueryDocsSchema>) {
  try {
    const { getServices } = await import('@/lib/mcp-tools');
    const { vectorSearchService } = await getServices();
    if (vectorSearchService) {
      const result = await vectorSearchService.searchDocuments({
        library_id: params.libraryId,
        query: params.query,
        version: params.version,
        max_results: params.maxResults || 10,
        include_code: true,
        context_limit: params.maxTokens || 4000
      });
      return result;
    }
  } catch (error) {
    logger.warn('[MCP Route] VectorSearchService unavailable, using fallback:', error);
  }

  // Fallback: return empty results with guidance
  return {
    libraryId: params.libraryId,
    query: params.query,
    results: [],
    totalResults: 0,
    totalTokens: 0,
    _note: 'VectorSearchService not available. Configure database and vector store for full documentation search.'
  };
}

// MCP Tool definitions
const MCP_TOOLS = [
  {
    name: 'resolve-library-id',
    description: 'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User question or task to help contextualize the search'
        },
        libraryName: {
          type: 'string',
          description: 'Human name of the library (e.g., "Supabase", "Next.js", "MongoDB")'
        }
      },
      required: ['query', 'libraryName']
    }
  },
  {
    name: 'query-docs',
    description: 'Search documentation for a specific library. Returns code snippets, guides, and API references optimized for LLM context.',
    inputSchema: {
      type: 'object',
      properties: {
        libraryId: {
          type: 'string',
          description: 'TwinMCP library ID in format /vendor/lib (e.g., /mongodb/docs, /vercel/next.js)'
        },
        query: {
          type: 'string',
          description: 'Question or task (setup, code example, configuration, etc.)'
        },
        version: {
          type: 'string',
          description: 'Optional specific version of the library'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 10)'
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens in response (default: 4000)'
        }
      },
      required: ['libraryId', 'query']
    }
  }
];

// Main MCP endpoint handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Extract API key from headers
  const apiKey = request.headers.get('TWINMCP_API_KEY') 
    || request.headers.get('Authorization')?.replace('Bearer ', '')
    || '';
  
  // Validate API key
  const auth = await validateApiKey(apiKey);
  
  if (!auth.valid) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message: 'Invalid or missing API key',
        data: { hint: 'Add TWINMCP_API_KEY header or Bearer token' }
      }
    } as MCPResponse, { status: 401 });
  }
  
  // Check rate limits
  const rateLimit = await checkRateLimit(auth.userId!, auth.plan!);
  
  if (!rateLimit.allowed) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32002,
        message: 'Rate limit exceeded',
        data: { remaining: rateLimit.remaining, plan: auth.plan }
      }
    } as MCPResponse, { 
      status: 429,
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Plan': auth.plan!
      }
    });
  }
  
  try {
    const body = await request.json() as MCPRequest;
    
    // Validate JSON-RPC format
    if (body.jsonrpc !== '2.0' || !body.method) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: { expected: 'JSON-RPC 2.0 format' }
        }
      } as MCPResponse, { status: 400 });
    }
    
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
        result = { tools: MCP_TOOLS };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = body.params as { name: string; arguments: Record<string, unknown> };
        
        if (name === 'resolve-library-id') {
          const parsed = ResolveLibraryIdSchema.parse(args);
          result = await resolveLibraryId(parsed);
          await trackUsage(auth.userId!, name, 50);
        } else if (name === 'query-docs') {
          const parsed = QueryDocsSchema.parse(args);
          result = await queryDocs(parsed);
          await trackUsage(auth.userId!, name, (result as any).totalTokens || 100);
        } else {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
              data: { availableTools: MCP_TOOLS.map(t => t.name) }
            }
          } as MCPResponse, { status: 400 });
        }
        break;
        
      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`,
            data: { availableMethods: ['initialize', 'tools/list', 'tools/call'] }
          }
        } as MCPResponse, { status: 400 });
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result
    } as MCPResponse, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    });
    
  } catch (error) {
    logger.error('MCP Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: error.errors
        }
      } as MCPResponse, { status: 400 });
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: { message: (error as Error).message }
      }
    } as MCPResponse, { status: 500 });
  }
}

// GET endpoint for health check and info
export async function GET() {
  return NextResponse.json({
    name: 'TwinMCP Server',
    version: '1.0.0',
    description: 'MCP server providing documentation and code snippets for any library',
    endpoints: {
      mcp: '/api/mcp',
      mcpOauth: '/api/mcp/oauth',
      libraries: '/api/libraries',
      health: '/api/mcp/health'
    },
    tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    documentation: 'https://twinmcp.com/docs',
    status: 'healthy'
  });
}
