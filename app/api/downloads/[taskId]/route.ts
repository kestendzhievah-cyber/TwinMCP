import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { DownloadManagerService } from '../../../../src/services/download-manager.service';
import { DOWNLOAD_CONFIG, STORAGE_CONFIG } from '../../../../src/config/download.config';

const db = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

const downloadManager = new DownloadManagerService(db, STORAGE_CONFIG, DOWNLOAD_CONFIG);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
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
    console.error('Error fetching download task:', error);
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
    console.error('Error deleting download task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
