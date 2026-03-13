/**
 * /api/mcp/initialize — Legacy initialize endpoint.
 *
 * Returns MCP server info. For proper MCP protocol initialization,
 * use POST /api/mcp with { "method": "initialize" }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';

const SERVER_INFO = {
  name: 'twinmcp-server',
  version: '1.0.0',
  protocol: 'MCP 2025-03-26',
  capabilities: {
    tools: { listChanged: false },
    logging: {},
  },
  tools: ['resolve-library-id', 'query-docs'],
};

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'MCP Server ready. Use POST /api/mcp for JSON-RPC protocol.',
    data: SERVER_INFO,
  });
}

export async function POST(request: NextRequest) {
  // Forward to /api/mcp as JSON-RPC initialize
  try {
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': request.headers.get('x-api-key') || '',
        authorization: request.headers.get('authorization') || '',
        twinmcp_api_key: request.headers.get('twinmcp_api_key') || '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `init_${Date.now()}`,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          clientInfo: { name: 'legacy-client', version: '1.0.0' },
        },
      }),
    });

    const result = await response.json();

    // Unwrap for legacy clients
    if (result.result) {
      return NextResponse.json({ success: true, data: result.result });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'McpInitialize');
  }
}
