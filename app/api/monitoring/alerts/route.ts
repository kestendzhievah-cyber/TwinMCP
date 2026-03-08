import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringService } from '../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication — monitoring data is sensitive
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const monitoringService = await getMonitoringService();
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as any;
    const service = searchParams.get('service');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    const filters: any = {};
    if (severity) filters.severity = severity;
    if (service) filters.source = service;
    if (tags && tags.length > 0) filters.tags = tags;

    const alerts = await monitoringService.getActiveAlerts(filters);

    return NextResponse.json({
      alerts,
      count: alerts.length,
      filters,
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication for alert creation
    const authPost = await validateAuth(request.headers.get('authorization'));
    if (!authPost.valid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.metric || !body.threshold) {
      return NextResponse.json(
        { error: 'Missing required fields: name, metric, threshold' },
        { status: 400 }
      );
    }

    // Validate threshold structure
    if (!body.threshold.operator || body.threshold.value === undefined) {
      return NextResponse.json(
        { error: 'Invalid threshold structure. Required: operator, value' },
        { status: 400 }
      );
    }

    const monitoringService = await getMonitoringService();
    const alert = await monitoringService.createAlert({
      name: body.name,
      description: body.description || '',
      severity: body.severity || 'warning',
      source: body.source || 'manual',
      metric: body.metric,
      threshold: body.threshold,
      currentValue: body.currentValue || 0,
      tags: body.tags || [],
      annotations: [],
    });

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
