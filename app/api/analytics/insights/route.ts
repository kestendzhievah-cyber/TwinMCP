// src/app/api/analytics/insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/src/services/analytics.service';

import { pool } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const db = pool;

const analyticsService = new AnalyticsService(db, redis);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse period parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    
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

    // Generate insights
    const insights = await analyticsService.generateInsights(period, userId || undefined);

    return NextResponse.json({
      insights,
      period,
      userId: userId || null,
      count: insights.length
    });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
