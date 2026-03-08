// src/app/api/analytics/realtime/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request.headers.get('authorization'));
    if (!authUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { analyticsService } = await getAnalyticsServices();
    // Get real-time metrics
    const realTimeMetrics = await analyticsService.getRealTimeMetrics();

    return NextResponse.json(realTimeMetrics);
  } catch (error) {
    logger.error('Error fetching real-time metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
