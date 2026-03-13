import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/v1/external-mcp/usage?serverId=xxx&days=30
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId') || undefined;
    const days = parseInt(searchParams.get('days') || '30', 10);

    const usage = await externalMcpService.getUsage(userId, serverId, days);
    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    return handleApiError(error, 'ExternalMcpUsage');
  }
}
