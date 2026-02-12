import { NextRequest, NextResponse } from 'next/server'
import { mcpTools, serverInfo, executeTool, validateToolArgs } from '@/lib/mcp-tools'

export async function GET() {
  try {
    return NextResponse.json({
      status: 'MCP server initialized',
      serverInfo: {
        name: 'corel-mcp-server',
        version: '1.0.0',
        tools: mcpTools.map(t => t.name),
        capabilities: {
          tools: {},
        }
      }
    })
  } catch (error) {
    console.error('Error initializing MCP server:', error)
    return NextResponse.json(
      { error: 'Failed to initialize MCP server' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { method, params } = body

    // Handle tool calls
    if (method === 'tools/call' && params?.name) {
      const { name, arguments: args } = params

      // Find the tool
      const tool = mcpTools.find(t => t.name === name)
      if (!tool) {
        return NextResponse.json({
          error: `Tool '${name}' not found`,
        }, { status: 404 })
      }

      // Validate required arguments
      const missingArgs = validateToolArgs(tool, args)
      if (missingArgs.length > 0) {
        return NextResponse.json({
          error: `Missing required arguments: ${missingArgs.join(', ')}`,
        }, { status: 400 })
      }

      // Execute the tool
      const result = executeTool(name, args)

      return NextResponse.json({
        result: {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        }
      })
    }

    // Handle tools list
    if (method === 'tools/list') {
      return NextResponse.json({
        tools: mcpTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      })
    }

    // Handle initialize
    if (method === 'initialize') {
      return NextResponse.json({
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'corel-mcp-server',
          version: '1.0.0',
        }
      })
    }

    return NextResponse.json({
      error: 'Method not supported',
    }, { status: 400 })

  } catch (error) {
    console.error('Error in MCP server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
      { status: 500 }
    )
  }
}
