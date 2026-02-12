// src/app/api/analytics/users/[userId]/route.ts
import { pool as db } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/src/services/analytics.service';

const analyticsService = new AnalyticsService(db, redis);

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
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

    // Get user analytics
    const userAnalytics = await analyticsService.getUserAnalytics(userId, period);

    return NextResponse.json(userAnalytics);
    
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
