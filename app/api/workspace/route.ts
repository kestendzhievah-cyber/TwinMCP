import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const workspaceService = await getWorkspaceService();
    const { name, options } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const workspace = await workspaceService.createWorkspace(name, userId, options);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error: any) {
    logger.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const workspaceService = await getWorkspaceService();
    const workspaces = await workspaceService.getUserWorkspaces(userId);

    return NextResponse.json(workspaces);
  } catch (error: any) {
    logger.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}
