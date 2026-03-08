import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

import { pool as db } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

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
        error: 'Failed to fetch monitoring data',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

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

    // Validate inputs to prevent injection and SSRF
    if (typeof owner !== 'string' || owner.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(owner)) {
      return NextResponse.json({ success: false, error: 'Invalid owner format' }, { status: 400 });
    }
    if (typeof repository !== 'string' || repository.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(repository)) {
      return NextResponse.json({ success: false, error: 'Invalid repository format' }, { status: 400 });
    }

    // Validate webhookUrl if provided — must be HTTPS to prevent SSRF to internal networks
    let safeWebhookUrl = webhookUrl;
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl);
        if (parsed.protocol !== 'https:') {
          return NextResponse.json({ success: false, error: 'Webhook URL must use HTTPS' }, { status: 400 });
        }
        // Block private/internal network ranges
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.') || host.endsWith('.local')) {
          return NextResponse.json({ success: false, error: 'Webhook URL cannot target internal networks' }, { status: 400 });
        }
        safeWebhookUrl = parsed.toString();
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid webhook URL format' }, { status: 400 });
      }
    }

    await db.query(
      `
      INSERT INTO github_monitoring (owner, repository, webhook_url, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (owner, repository) DO UPDATE SET
        webhook_url = EXCLUDED.webhook_url,
        updated_at = NOW()
    `,
      [owner, repository, safeWebhookUrl]
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
        error: 'Failed to configure GitHub monitoring',
      },
      { status: 500 }
    );
  }
}
