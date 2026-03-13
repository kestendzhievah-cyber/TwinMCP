import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// POST /api/v1/external-mcp/[serverId]/health — Run health check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { serverId } = await params;
    const result = await externalMcpService.healthCheck(serverId, userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Server not found') {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 });
    }
    return handleApiError(error, 'ExternalMcpHealthCheck');
  }
}
