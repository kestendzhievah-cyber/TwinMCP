/**
 * /api/mcp/call — Legacy tool-call endpoint.
 *
 * Wraps the request into proper MCP JSON-RPC format and forwards
 * to the main /api/mcp endpoint. Kept for backward compatibility.
 *
 * Preferred usage: POST /api/mcp with JSON-RPC 2.0 body.
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, arguments: args } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 });
    }

    // Forward as JSON-RPC to /api/mcp
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
        id: `call_${Date.now()}`,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });

    const result = await response.json();

    // Unwrap JSON-RPC for legacy clients expecting { content: [...] }
    if (result.result) return NextResponse.json(result.result);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'McpCallLegacy');
  }
}
