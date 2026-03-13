import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; path: string[] }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { serverId, path } = await params;
    const targetPath = path.join('/');

    let body: any = undefined;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      try {
        body = await request.json();
      } catch {
        // no body
      }
    }

    const result = await externalMcpService.proxy(
      serverId,
      userId,
      userId,
      targetPath,
      request.method,
      body
    );

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleApiError(error, 'ExternalMcpProxy');
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
