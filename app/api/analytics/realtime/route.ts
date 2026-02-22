// src/app/api/analytics/realtime/route.ts
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { analyticsService } = await getAnalyticsServices();
    // Get real-time metrics
    const realTimeMetrics = await analyticsService.getRealTimeMetrics();

    return NextResponse.json(realTimeMetrics);
    
  } catch (error) {
    logger.error('Error fetching real-time metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
