import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { mcpToolsService } from '@/lib/mcp-tools/mcp-tools.service';
import { TOOL_CATEGORIES, type McpToolCategory } from '@/lib/mcp-tools/catalog';

// GET /api/v1/mcp-tools — List catalog with user activation status
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.slice(0, 200) || undefined;
    const rawCategory = searchParams.get('category') || undefined;
    let category: McpToolCategory | undefined;
    if (rawCategory) {
      if (!(rawCategory in TOOL_CATEGORIES)) {
        throw new ValidationError(`Catégorie invalide : ${rawCategory}`);
      }
      category = rawCategory as McpToolCategory;
    }

    const catalog = await mcpToolsService.getCatalog(userId, query, category);

    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    return handleApiError(error, 'McpToolsCatalog');
  }
}
