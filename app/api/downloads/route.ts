import { NextRequest, NextResponse } from 'next/server';
import { DownloadManagerService } from '../../../src/services/download-manager.service';
import { DOWNLOAD_CONFIG, STORAGE_CONFIG } from '../../../src/config/download.config';

import { pool as db } from '@/lib/prisma'

const downloadManager = new DownloadManagerService(db, STORAGE_CONFIG, DOWNLOAD_CONFIG);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both formats: { githubUrl } or { type, source }
    let taskData;

    if (body.githubUrl) {
      // Extract owner/repo from GitHub URL
      const match = body.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return NextResponse.json(
          { success: false, error: 'Invalid GitHub URL format' },
          { status: 400 }
        );
      }
      const [, owner, repository] = match;

      taskData = {
        type: 'github' as const,
        source: { owner, repository: repository.replace('.git', '').replace(/\/$/, '') },
        options: body.options || {
          shallow: true,
          includeDocs: true,
          includeTests: false,
          includeExamples: true,
          maxDepth: 5,
          excludePatterns: [],
        },
        priority: body.priority || 'normal',
        metadata: { size: 0, files: 0, duration: 0 },
      };
    } else {
      taskData = {
        type: body.type,
        source: body.source,
        options: body.options || {
          shallow: true,
          includeDocs: true,
          includeTests: false,
          includeExamples: true,
          maxDepth: 5,
          excludePatterns: [],
        },
        priority: body.priority || 'normal',
        metadata: { size: 0, files: 0, duration: 0 },
      };
    }

    const taskId = await downloadManager.createDownloadTask(taskData);

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Download task created successfully',
    });
  } catch (error) {
    console.error('Error creating download task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (taskId) {
      const task = await downloadManager.getDownloadStatus(taskId);

      if (!task) {
        return NextResponse.json(
          { success: false, error: 'Task not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, task });
    } else {
      const queue = await downloadManager.getDownloadQueue();
      return NextResponse.json({ success: true, queue });
    }
  } catch (error) {
    console.error('Error fetching download status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
