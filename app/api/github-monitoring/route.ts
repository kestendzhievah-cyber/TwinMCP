import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

import { pool as db } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repository = searchParams.get('repository');

    if (!owner || !repository) {
      return NextResponse.json(
        {
          success: false,
          error: 'Owner and repository parameters are required',
        },
        { status: 400 }
      );
    }

    const monitoringData = {
      owner,
      repository,
      stars: 1250,
      forks: 89,
      lastCommit: '2024-01-13T10:30:00Z',
      openIssues: 23,
      status: 'active',
    };

    return NextResponse.json({
      success: true,
      data: monitoringData,
    });
  } catch (error) {
    logger.error('Error in GitHub monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { owner, repository, webhookUrl } = body;

    if (!owner || !repository) {
      return NextResponse.json(
        {
          success: false,
          error: 'Owner and repository are required',
        },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO github_monitoring (owner, repository, webhook_url, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (owner, repository) DO UPDATE SET
        webhook_url = EXCLUDED.webhook_url,
        updated_at = NOW()
    `,
      [owner, repository, webhookUrl]
    );

    return NextResponse.json({
      success: true,
      message: 'GitHub monitoring configured successfully',
    });
  } catch (error) {
    logger.error('Error configuring GitHub monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
