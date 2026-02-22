import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

let _services: { downloadManager: any; db: any } | null = null;
async function getServices() {
  if (!_services) {
    const { pool: db } = await import('@/lib/prisma');
    const { DownloadManagerService } = await import('../../../../src/services/download-manager.service');
    const { DOWNLOAD_CONFIG, STORAGE_CONFIG } = await import('../../../../src/config/download.config');
    _services = { downloadManager: new DownloadManagerService(db, STORAGE_CONFIG, DOWNLOAD_CONFIG), db };
  }
  return _services;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { downloadManager } = await getServices();
    const { taskId } = await params;
    const task = await downloadManager.getDownloadStatus(taskId);

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('Error fetching download task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    const { downloadManager, db } = await getServices();
    const { taskId } = await params;
    const task = await downloadManager.getDownloadStatus(taskId);

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
