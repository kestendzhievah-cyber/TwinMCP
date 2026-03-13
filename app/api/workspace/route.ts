import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

let _workspaceService: any = null;
async function getWorkspaceService() {
  if (!_workspaceService) {
    const { pool: db } = await import('@/lib/prisma');
    const { WorkspaceService } = await import('@/src/services/collaboration/workspace.service');
    _workspaceService = new WorkspaceService(db);
  }
  return _workspaceService;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const workspaceService = await getWorkspaceService();
    const { name, options } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const workspace = await workspaceService.createWorkspace(name, userId, options);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreateWorkspace');
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const workspaceService = await getWorkspaceService();
    const workspaces = await workspaceService.getUserWorkspaces(userId);

    return NextResponse.json(workspaces);
  } catch (error) {
    return handleApiError(error, 'ListWorkspaces');
  }
}
