import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { mcpToolsService } from '@/lib/mcp-tools/mcp-tools.service';

// POST /api/v1/mcp-tools/[toolId]/activate — Activate a tool (Pro only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { toolId } = await params;

    let config: Record<string, unknown> | undefined;
    try {
      const body = await request.json();
      config = body.config;
    } catch {
      // No body or invalid JSON — config is optional
    }

    const result = await mcpToolsService.activateTool(userId, toolId, config);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'McpToolActivate');
  }
}
