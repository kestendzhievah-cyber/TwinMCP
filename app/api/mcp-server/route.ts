/**
 * /api/mcp-server — Legacy MCP server endpoint.
 *
 * Redirects to the main /api/mcp endpoint which implements the full
 * MCP JSON-RPC 2.0 protocol. This route is kept for backward compatibility.
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    serverInfo: {
      name: 'twinmcp-server',
      version: '1.0.0',
    },
    _redirect: 'Use POST /api/mcp for MCP JSON-RPC protocol. GET /api/mcp for server discovery.',
  });
}

export async function POST(request: NextRequest) {
  // Forward to the main /api/mcp endpoint
  try {
    const body = await request.json();

    // Wrap legacy non-JSON-RPC requests into proper JSON-RPC format
    let jsonRpcBody = body;
    if (!body.jsonrpc) {
      const { method, params } = body;
      jsonRpcBody = {
        jsonrpc: '2.0',
        id: `legacy_${Date.now()}`,
        method: method || 'initialize',
        params,
      };
    }

    // Use internal fetch to /api/mcp
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': request.headers.get('x-api-key') || '',
        authorization: request.headers.get('authorization') || '',
        twinmcp_api_key: request.headers.get('twinmcp_api_key') || '',
      },
      body: JSON.stringify(jsonRpcBody),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    logger.error('[MCP-Server Legacy] Error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error' },
      },
      { status: 200 }
    );
  }
}
