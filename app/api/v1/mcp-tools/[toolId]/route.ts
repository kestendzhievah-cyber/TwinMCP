import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { mcpToolsService } from '@/lib/mcp-tools/mcp-tools.service';

// GET /api/v1/mcp-tools/[toolId] — Get tool details with activation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { toolId } = await params;
    const tool = await mcpToolsService.getToolDetails(userId, toolId);

    return NextResponse.json({ success: true, data: tool });
  } catch (error) {
    return handleApiError(error, 'McpToolDetails');
  }
}
