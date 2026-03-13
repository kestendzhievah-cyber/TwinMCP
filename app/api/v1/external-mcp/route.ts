import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/v1/external-mcp — List all external MCP servers for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const servers = await externalMcpService.list(userId);
    return NextResponse.json({ success: true, data: servers });
  } catch (error) {
    return handleApiError(error, 'ExternalMcpList');
  }
}

// POST /api/v1/external-mcp — Register a new external MCP server
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const body = await request.json();

    const { name, description, baseUrl, authType, secret } = body;
    if (!name || typeof name !== 'string' || !baseUrl || typeof baseUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name and baseUrl are required' },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.length > 200) {
      return NextResponse.json(
        { success: false, error: 'name must be at most 200 characters' },
        { status: 400 }
      );
    }

    // Validate baseUrl is a valid http(s) URL to prevent SSRF via internal URLs
    try {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json(
          { success: false, error: 'baseUrl must use http or https protocol' },
          { status: 400 }
        );
      }
      // Block common internal/private network targets
      const hostname = parsed.hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname) ||
          hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
          hostname.startsWith('172.') || hostname.endsWith('.internal') ||
          hostname.endsWith('.local')) {
        return NextResponse.json(
          { success: false, error: 'baseUrl must not point to internal/private networks' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'baseUrl must be a valid URL' },
        { status: 400 }
      );
    }

    const server = await externalMcpService.create(userId, {
      name,
      description,
      baseUrl,
      authType: authType || 'NONE',
      secret,
    });

    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'ExternalMcpCreate');
  }
}
