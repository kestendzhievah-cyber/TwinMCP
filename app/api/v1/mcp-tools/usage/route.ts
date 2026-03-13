import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { mcpToolsService } from '@/lib/mcp-tools/mcp-tools.service';

// GET /api/v1/mcp-tools/usage?days=30 — Get usage stats (Pro only)
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { searchParams } = new URL(request.url);
    const parsed = parseInt(searchParams.get('days') || '30', 10);
    const days = Math.min(Math.max(Number.isNaN(parsed) ? 30 : parsed, 1), 365);

    const stats = await mcpToolsService.getUsageStats(userId, days);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return handleApiError(error, 'McpToolsUsage');
  }
}
