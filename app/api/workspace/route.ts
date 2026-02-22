import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

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
    const workspaceService = await getWorkspaceService();
    const { name, ownerId, options } = await req.json();

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const workspace = await workspaceService.createWorkspace(name, ownerId, options);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error: any) {
    logger.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const workspaceService = await getWorkspaceService();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const workspaces = await workspaceService.getUserWorkspaces(userId);

    return NextResponse.json(workspaces);
  } catch (error: any) {
    logger.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}
