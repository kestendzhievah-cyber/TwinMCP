import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { mcpTools, serverInfo } from '@/lib/mcp-tools';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      tools: mcpTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      serverInfo: {
        name: serverInfo.name,
        version: serverInfo.version,
      }
    });
  } catch (error) {
    logger.error('Error listing MCP tools:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
