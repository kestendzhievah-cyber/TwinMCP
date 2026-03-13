import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

import { pool as db } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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

    // Fetch real monitoring data from DB
    const result = await db.query(
      `SELECT owner, repository, webhook_url, stars, forks, last_commit, open_issues, status, created_at, updated_at
       FROM github_monitoring
       WHERE owner = $1 AND repository = $2`,
      [owner, repository]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { owner, repository, status: 'not_monitored' },
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        owner: row.owner,
        repository: row.repository,
        stars: row.stars ?? 0,
        forks: row.forks ?? 0,
        lastCommit: row.last_commit,
        openIssues: row.open_issues ?? 0,
        status: row.status ?? 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GitHubMonitoringGet');
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'GitHubMonitoringPost');
  }
}
