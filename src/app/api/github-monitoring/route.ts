import { NextRequest, NextResponse } from 'next/server';
import { GitHubMonitoringService } from '@/services/github-monitoring.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Initialize database and Redis connections
const db = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

const redis = process.env['REDIS_URL'] ? new Redis(process.env['REDIS_URL']) : new Redis();

// Initialize monitoring service
const monitoringService = new GitHubMonitoringService(
  db,
  redis,
  {
    githubToken: process.env['GITHUB_TOKEN'] || '',
    ...(process.env['GITHUB_WEBHOOK_SECRET'] && { webhookSecret: process.env['GITHUB_WEBHOOK_SECRET'] })
  }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health':
        const health = await monitoringService.healthCheck();
        return NextResponse.json(health);

      case 'repositories':
        const repositories = await getMonitoredRepositories();
        return NextResponse.json(repositories);

      case 'stats':
        const owner = searchParams.get('owner');
        const name = searchParams.get('name');
        
        if (!owner || !name) {
          return NextResponse.json(
            { error: 'Owner and name parameters are required' },
            { status: 400 }
          );
        }

        const stats = await getRepositoryStats(owner, name);
        return NextResponse.json(stats);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GitHub monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'start-monitoring':
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration is required' },
            { status: 400 }
          );
        }

        await monitoringService.startMonitoring(config);
        return NextResponse.json({ 
          message: `Monitoring started for ${config.repository.owner}/${config.repository.name}` 
        });

      case 'webhook':
        const webhookEvent = await parseWebhookEvent(request);
        if (webhookEvent) {
          const result = await monitoringService.handleWebhookEvent(webhookEvent);
          return NextResponse.json(result);
        }
        return NextResponse.json({ message: 'Webhook received' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GitHub monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getMonitoredRepositories() {
  const result = await db.query(`
    SELECT 
      id,
      owner,
      name,
      full_name,
      default_branch,
      is_active,
      last_checked,
      error_count,
      created_at,
      updated_at
    FROM monitored_repositories 
    ORDER BY created_at DESC
  `);

  return result.rows;
}

async function getRepositoryStats(owner: string, name: string) {
  const statsKey = `monitoring:stats:${owner}/${name}`;
  const cachedStats = await redis.get(statsKey);

  if (cachedStats) {
    return JSON.parse(cachedStats);
  }

  // Return empty stats if not found
  return {
    repositoryId: 0,
    lastChecked: null,
    totalReleases: 0,
    totalCommits: 0,
    totalIssues: 0,
    recentActivity: {
      releases: 0,
      commits: 0,
      issues: 0,
      stars: 0,
      forks: 0
    },
    errorCount: 0
  };
}

async function parseWebhookEvent(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    if (!signature) {
      console.warn('Missing GitHub webhook signature');
      return null;
    }

    // TODO: Implement webhook signature verification when webhooks are fully implemented
    // const isValid = verifySignature(body, signature);
    // if (!isValid) {
    //   console.warn('Invalid webhook signature');
    //   return null;
    // }

    const payload = JSON.parse(body);
    const eventType = request.headers.get('x-github-event');

    if (!eventType) {
      console.warn('Missing GitHub event type');
      return null;
    }

    // Extract repository information from payload
    const repository = payload.repository;
    if (!repository) {
      console.warn('Missing repository in webhook payload');
      return null;
    }

    return {
      id: payload['x-github-delivery'] || generateEventId(),
      type: eventType as 'push' | 'release' | 'issues' | 'pull_request' | 'star',
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        owner: {
          login: repository.owner.login,
          id: repository.owner.id,
          type: repository.owner.type
        },
        description: repository.description || '',
        url: repository.html_url,
        cloneUrl: repository.clone_url,
        homepage: repository.homepage || undefined,
        language: repository.language || '',
        languages: {}, // Would need additional API call
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        issues: repository.open_issues_count,
        openIssues: repository.open_issues_count,
        watchers: repository.watchers_count,
        defaultBranch: repository.default_branch,
        createdAt: new Date(repository.created_at),
        updatedAt: new Date(repository.updated_at),
        pushedAt: new Date(repository.pushed_at),
        size: repository.size,
        isArchived: repository.archived,
        isDisabled: repository.disabled,
        ...(repository.license && {
          license: {
            key: String(repository.license.key),
            name: String(repository.license.name),
            url: String(repository.license.url || '')
          }
        }),
        topics: repository.topics || []
      } as any, // Type assertion to bypass strict typing
      payload,
      timestamp: new Date(),
      processed: false
    };
  } catch (error) {
    console.error('Error parsing webhook event:', error);
    return null;
  }
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
