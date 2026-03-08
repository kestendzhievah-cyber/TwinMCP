import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

let _services: { downloadManager: any; db: any } | null = null;
async function getServices() {
  if (!_services) {
    const { pool: db } = await import('@/lib/prisma');
    const { DownloadManagerService } =
      await import('../../../../src/services/download-manager.service');
    const { DOWNLOAD_CONFIG, STORAGE_CONFIG } =
      await import('../../../../src/config/download.config');
    _services = {
      downloadManager: new DownloadManagerService(db, STORAGE_CONFIG, DOWNLOAD_CONFIG),
      db,
    };
  }
  return _services;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getAuthUserId(_request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { downloadManager } = await getServices();
    const { taskId } = await params;
    const task = await downloadManager.getDownloadStatus(taskId);

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('Error fetching download task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch download task',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getAuthUserId(_request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { downloadManager, db } = await getServices();
    const { taskId } = await params;
    const task = await downloadManager.getDownloadStatus(taskId);

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'downloading') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a task that is currently downloading' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM download_tasks WHERE id = $1', [taskId]);
    await db.query('DELETE FROM download_results WHERE task_id = $1', [taskId]);

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting download task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete download task',
      },
      { status: 500 }
    );
  }
}
