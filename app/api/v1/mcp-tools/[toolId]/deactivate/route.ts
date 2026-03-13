import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { mcpToolsService } from '@/lib/mcp-tools/mcp-tools.service';

// POST /api/v1/mcp-tools/[toolId]/deactivate — Deactivate a tool (Pro only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { toolId } = await params;
    const result = await mcpToolsService.deactivateTool(userId, toolId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'McpToolDeactivate');
  }
}
