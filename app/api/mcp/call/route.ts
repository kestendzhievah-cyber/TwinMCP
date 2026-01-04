import { NextRequest, NextResponse } from 'next/server';
import { mcpTools, executeTool, validateToolArgs } from '@/lib/mcp-tools';

// Simulate tool execution results
const getToolResult = (toolName: string, args: any) => {
  return executeTool(toolName, args);
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, arguments: args } = body;

    // Validate required parameters
    if (!name) {
      return NextResponse.json({
        error: 'Tool name is required',
      }, { status: 400 });
    }

    // Find the tool
    const tool = mcpTools.find(t => t.name === name);
    if (!tool) {
      return NextResponse.json({
        error: `Tool '${name}' not found`,
      }, { status: 404 });
    }

    // Validate required arguments
    const missingArgs = validateToolArgs(tool, args);

    if (missingArgs.length > 0) {
      return NextResponse.json({
        error: `Missing required arguments: ${missingArgs.join(', ')}`,
      }, { status: 400 });
    }

    // Execute the tool (simulation)
    const result = getToolResult(name, args);

    return NextResponse.json({
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    });

  } catch (error) {
    console.error('Error executing MCP tool:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
