import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { WorkspaceService } from '@/src/services/collaboration/workspace.service';

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

const workspaceService = new WorkspaceService(db);

export async function POST(req: NextRequest) {
  try {
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
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
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
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}
