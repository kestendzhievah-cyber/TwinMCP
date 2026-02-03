import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
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
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey, active: true },
      include: { user: true }
    });
    
    if (!key) return { valid: false };
    
    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() }
    });
    
    return {
      valid: true,
      userId: key.userId,
      plan: key.user?.plan || 'free'
    };
  } catch {
    return { valid: false };
  }
}

// Rate limiting check
async function checkRateLimit(userId: string, plan: string): Promise<{ allowed: boolean; remaining: number }> {
  const limits: Record<string, number> = {
    free: 100,
    professional: 10000,
    enterprise: 100000
  };
  
  const limit = limits[plan] || limits.free;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  try {
    const usage = await prisma.apiUsage.count({
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
    await prisma.apiUsage.create({
      data: {
        userId,
        tool,
        tokens,
        createdAt: new Date()
      }
    });
  } catch (e) {
    console.error('Failed to track usage:', e);
  }
}

// Library database (simplified - in production, use full database)
const LIBRARY_DATABASE: Record<string, {
  id: string;
  name: string;
  vendor: string;
  repo: string;
  description: string;
  versions: string[];
  popularity: number;
  ecosystem: string;
}> = {
  'nextjs': {
    id: '/vercel/next.js',
    name: 'Next.js',
    vendor: 'vercel',
    repo: 'https://github.com/vercel/next.js',
    description: 'The React Framework for the Web',
    versions: ['15.0', '14.2', '14.1', '14.0', '13.5'],
    popularity: 98,
    ecosystem: 'npm'
  },
  'react': {
    id: '/facebook/react',
    name: 'React',
    vendor: 'facebook',
    repo: 'https://github.com/facebook/react',
    description: 'A JavaScript library for building user interfaces',
    versions: ['19.0', '18.3', '18.2', '18.1', '18.0'],
    popularity: 100,
    ecosystem: 'npm'
  },
  'mongodb': {
    id: '/mongodb/docs',
    name: 'MongoDB',
    vendor: 'mongodb',
    repo: 'https://github.com/mongodb/mongo',
    description: 'The database for modern applications',
    versions: ['8.0', '7.0', '6.0', '5.0'],
    popularity: 95,
    ecosystem: 'npm'
  },
  'supabase': {
    id: '/supabase/supabase',
    name: 'Supabase',
    vendor: 'supabase',
    repo: 'https://github.com/supabase/supabase',
    description: 'The open source Firebase alternative',
    versions: ['2.45', '2.44', '2.43'],
    popularity: 92,
    ecosystem: 'npm'
  },
  'prisma': {
    id: '/prisma/prisma',
    name: 'Prisma',
    vendor: 'prisma',
    repo: 'https://github.com/prisma/prisma',
    description: 'Next-generation Node.js and TypeScript ORM',
    versions: ['6.0', '5.22', '5.21', '5.20'],
    popularity: 90,
    ecosystem: 'npm'
  },
  'express': {
    id: '/expressjs/express',
    name: 'Express.js',
    vendor: 'expressjs',
    repo: 'https://github.com/expressjs/express',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    versions: ['5.0', '4.21', '4.20', '4.19'],
    popularity: 97,
    ecosystem: 'npm'
  },
  'tailwindcss': {
    id: '/tailwindlabs/tailwindcss',
    name: 'Tailwind CSS',
    vendor: 'tailwindlabs',
    repo: 'https://github.com/tailwindlabs/tailwindcss',
    description: 'A utility-first CSS framework',
    versions: ['4.0', '3.4', '3.3', '3.2'],
    popularity: 96,
    ecosystem: 'npm'
  },
  'typescript': {
    id: '/microsoft/typescript',
    name: 'TypeScript',
    vendor: 'microsoft',
    repo: 'https://github.com/microsoft/TypeScript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
    versions: ['5.7', '5.6', '5.5', '5.4'],
    popularity: 99,
    ecosystem: 'npm'
  }
};

// resolve-library-id implementation
async function resolveLibraryId(params: z.infer<typeof ResolveLibraryIdSchema>) {
  const { query, libraryName } = params;
  const searchTerm = libraryName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Find matching libraries
  const matches: Array<{
    libraryId: string;
    name: string;
    vendor: string;
    description: string;
    repo: string;
    defaultVersion: string;
    popularity: number;
    confidence: number;
  }> = [];
  
  for (const [key, lib] of Object.entries(LIBRARY_DATABASE)) {
    const keyLower = key.toLowerCase();
    const nameLower = lib.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let confidence = 0;
    
    if (keyLower === searchTerm || nameLower === searchTerm) {
      confidence = 1.0;
    } else if (keyLower.includes(searchTerm) || searchTerm.includes(keyLower)) {
      confidence = 0.8;
    } else if (nameLower.includes(searchTerm) || searchTerm.includes(nameLower)) {
      confidence = 0.7;
    }
    
    if (confidence > 0) {
      matches.push({
        libraryId: lib.id,
        name: lib.name,
        vendor: lib.vendor,
        description: lib.description,
        repo: lib.repo,
        defaultVersion: lib.versions[0],
        popularity: lib.popularity,
        confidence
      });
    }
  }
  
  // Sort by confidence and popularity
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.popularity - a.popularity;
  });
  
  return {
    results: matches.slice(0, 5),
    totalFound: matches.length,
    query: libraryName,
    processingTimeMs: 10
  };
}

// query-docs implementation
async function queryDocs(params: z.infer<typeof QueryDocsSchema>) {
  const { libraryId, query, version, maxResults = 10, maxTokens = 4000 } = params;
  
  // Find the library
  const lib = Object.values(LIBRARY_DATABASE).find(l => l.id === libraryId);
  
  if (!lib) {
    return {
      libraryId,
      query,
      results: [],
      totalResults: 0,
      totalTokens: 0,
      error: `Library not found: ${libraryId}`
    };
  }
  
  // Generate contextual documentation snippets
  // In production, this would query a vector database with actual documentation
  const snippets = generateDocSnippets(lib, query, version || lib.versions[0]);
  
  const totalTokens = snippets.reduce((sum, s) => sum + s.tokens, 0);
  
  return {
    libraryId,
    libraryName: lib.name,
    version: version || lib.versions[0],
    query,
    results: snippets.slice(0, maxResults),
    totalResults: snippets.length,
    totalTokens: Math.min(totalTokens, maxTokens),
    sourceUrl: lib.repo,
    lastUpdated: new Date().toISOString()
  };
}

// Generate documentation snippets based on query
function generateDocSnippets(lib: typeof LIBRARY_DATABASE[string], query: string, version: string) {
  const queryLower = query.toLowerCase();
  const snippets: Array<{
    type: 'snippet' | 'guide' | 'api_ref';
    title: string;
    content: string;
    url: string;
    relevanceScore: number;
    tokens: number;
  }> = [];
  
  // Common patterns
  if (queryLower.includes('setup') || queryLower.includes('install') || queryLower.includes('start')) {
    snippets.push({
      type: 'guide',
      title: `Getting Started with ${lib.name}`,
      content: `# Installation\n\n\`\`\`bash\nnpm install ${lib.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}\n\`\`\`\n\n## Quick Start\n\nImport and initialize ${lib.name} in your project:\n\n\`\`\`javascript\nimport ${lib.name.replace(/[^a-zA-Z]/g, '')} from '${lib.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}';\n\n// Initialize\nconst instance = new ${lib.name.replace(/[^a-zA-Z]/g, '')}();\n\`\`\``,
      url: `${lib.repo}/blob/main/docs/getting-started.md`,
      relevanceScore: 0.95,
      tokens: 150
    });
  }
  
  if (queryLower.includes('config') || queryLower.includes('configuration')) {
    snippets.push({
      type: 'guide',
      title: `${lib.name} Configuration Guide`,
      content: `# Configuration\n\n${lib.name} can be configured via:\n\n1. **Configuration file** - Create a \`${lib.name.toLowerCase()}.config.js\` file\n2. **Environment variables** - Set \`${lib.name.toUpperCase().replace(/[^A-Z]/g, '_')}_*\` env vars\n3. **Programmatic config** - Pass options to the constructor\n\n\`\`\`javascript\nmodule.exports = {\n  // Your ${lib.name} configuration\n  debug: process.env.NODE_ENV === 'development',\n  // Add more options here\n};\n\`\`\``,
      url: `${lib.repo}/blob/main/docs/configuration.md`,
      relevanceScore: 0.9,
      tokens: 180
    });
  }
  
  if (queryLower.includes('api') || queryLower.includes('method') || queryLower.includes('function')) {
    snippets.push({
      type: 'api_ref',
      title: `${lib.name} API Reference`,
      content: `# API Reference\n\n## Core Methods\n\n### \`init(options)\`\nInitialize ${lib.name} with options.\n\n### \`connect()\`\nEstablish connection.\n\n### \`query(params)\`\nExecute a query with the given parameters.\n\n### \`close()\`\nGracefully close connections and cleanup resources.\n\nSee full API documentation at: ${lib.repo}`,
      url: `${lib.repo}/blob/main/docs/api.md`,
      relevanceScore: 0.85,
      tokens: 200
    });
  }
  
  // Always add a general overview
  snippets.push({
    type: 'snippet',
    title: `${lib.name} v${version} Overview`,
    content: `# ${lib.name}\n\n${lib.description}\n\n## Features\n\n- Full TypeScript support\n- Modern API design\n- Excellent documentation\n- Active community\n\n## Resources\n\n- GitHub: ${lib.repo}\n- Documentation: ${lib.repo}/docs\n- Changelog: ${lib.repo}/releases`,
    url: lib.repo,
    relevanceScore: 0.7,
    tokens: 120
  });
  
  // Sort by relevance
  snippets.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return snippets;
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
    console.error('MCP Error:', error);
    
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
