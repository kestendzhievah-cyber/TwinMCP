/**
 * POST /api/graphql — Execute GraphQL queries against MCP tools and services.
 * GET  /api/graphql — Schema introspection.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createMCPGraphQLGateway, GraphQLContext } from '@/lib/mcp/middleware/graphql'

let gateway: ReturnType<typeof createMCPGraphQLGateway> | null = null

function getGateway() {
  if (!gateway) {
    gateway = createMCPGraphQLGateway()

    // Register MCP tool queries
    gateway.addQuery('tools', {
      type: '[Tool]',
      description: 'List available MCP tools',
      resolve: async () => {
        try {
          const { registry } = await import('@/lib/mcp/core/registry')
          return registry.getAll().map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            version: t.version,
          }))
        } catch {
          return []
        }
      },
    })

    gateway.addQuery('tool', {
      type: 'Tool',
      description: 'Get a specific MCP tool by ID',
      args: { id: { type: 'String', required: true } },
      resolve: async (_parent, args) => {
        try {
          const { registry } = await import('@/lib/mcp/core/registry')
          const tool = registry.get(args.id)
          if (!tool) return null
          return {
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            version: tool.version,
            inputSchema: tool.inputSchema,
          }
        } catch {
          return null
        }
      },
    })

    gateway.addMutation('executeTool', {
      type: 'ToolResult',
      description: 'Execute an MCP tool',
      args: {
        toolId: { type: 'String', required: true },
        input: { type: 'JSON', required: false, defaultValue: {} },
      },
      resolve: async (_parent, args, ctx) => {
        if (!ctx.isAuthenticated) {
          throw new Error('Authentication required')
        }
        try {
          const { registry } = await import('@/lib/mcp/core/registry')
          const { ToolExecutor } = await import('@/lib/mcp/core/tool-executor')
          const tool = registry.get(args.toolId)
          if (!tool) throw new Error(`Tool not found: ${args.toolId}`)
          const executor = new ToolExecutor()
          return await executor.execute(tool, args.input || {}, { userId: ctx.userId })
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err))
        }
      },
    })
  }
  return gateway
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const gw = getGateway()

    const context: GraphQLContext = {
      userId: request.headers.get('x-user-id') || undefined,
      apiKey: request.headers.get('x-api-key') || undefined,
      isAuthenticated: !!(request.headers.get('x-api-key') || request.headers.get('authorization')),
    }

    const result = await gw.execute(body, context)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { errors: [{ message: error instanceof Error ? error.message : 'Internal error' }] },
      { status: 500 }
    )
  }
}

export async function GET() {
  const gw = getGateway()
  const schema = gw.getSchema()
  return NextResponse.json({
    message: 'TwinMCP GraphQL API',
    schema,
    usage: {
      endpoint: 'POST /api/graphql',
      example: {
        query: '{ health { status timestamp } tools { id name description } }',
      },
    },
  })
}
