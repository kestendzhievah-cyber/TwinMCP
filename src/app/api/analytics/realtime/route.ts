// src/app/api/analytics/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/services/analytics.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

// Initialize database and Redis connections
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

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
