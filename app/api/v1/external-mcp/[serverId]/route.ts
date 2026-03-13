import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/v1/external-mcp/[serverId] — Get server details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { serverId } = await params;
    const server = await externalMcpService.getById(serverId, userId);
    if (!server) {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    return handleApiError(error, 'GetExternalMcpServer');
  }
}

// PUT /api/v1/external-mcp/[serverId] — Update server
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { serverId } = await params;
    const body = await request.json();
    // Whitelist safe fields to prevent mass assignment (e.g., overwriting ownerId, encryptedSecret)
    const safeUpdate: Record<string, unknown> = {};
    if (typeof body.name === 'string') safeUpdate.name = body.name;
    if (typeof body.description === 'string') safeUpdate.description = body.description;
    if (typeof body.baseUrl === 'string') safeUpdate.baseUrl = body.baseUrl;
    if (typeof body.authType === 'string' && ['NONE', 'API_KEY', 'BEARER', 'OAUTH'].includes(body.authType)) {
      safeUpdate.authType = body.authType;
    }
    const server = await externalMcpService.update(serverId, userId, safeUpdate);
    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    if (error instanceof Error && error.message === 'Server not found') {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 });
    }
    return handleApiError(error, 'UpdateExternalMcpServer');
  }
}

// DELETE /api/v1/external-mcp/[serverId] — Delete server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();
    const { serverId } = await params;
    await externalMcpService.delete(serverId, userId);
    return NextResponse.json({ success: true, message: 'Server deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Server not found') {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 });
    }
    return handleApiError(error, 'DeleteExternalMcpServer');
  }
}
