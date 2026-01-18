// src/app/api/analytics/usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/services/analytics.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { AnalyticsFilter } from '@/types/analytics.types';

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
    const { searchParams } = new URL(request.url);
    
    // Parse period parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
    }

    const period = {
      start: new Date(startDate),
      end: new Date(endDate)
    };

    // Validate date range
    if (period.start >= period.end) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Parse optional filters
    const filters: AnalyticsFilter = {
      period,
      userId: searchParams.get('userId') || undefined,
      provider: searchParams.get('provider') || undefined,
      model: searchParams.get('model') || undefined,
      country: searchParams.get('country') || undefined,
      device: searchParams.get('device') || undefined,
      eventType: searchParams.get('eventType') || undefined,
      conversion: searchParams.get('conversion') || undefined,
    };

    // Get usage metrics
    const usageMetrics = await analyticsService.getUsageMetrics(period, filters);

    return NextResponse.json(usageMetrics);
    
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
