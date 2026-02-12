// src/app/api/analytics/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/src/services/analytics.service';

import { pool } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const db = pool;

const analyticsService = new AnalyticsService(db, redis);

export async function GET(request: NextRequest) {
  try {
    // Get real-time metrics
    const realTimeMetrics = await analyticsService.getRealTimeMetrics();

    return NextResponse.json(realTimeMetrics);
    
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
