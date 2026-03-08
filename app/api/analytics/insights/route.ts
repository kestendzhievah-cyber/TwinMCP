// src/app/api/analytics/insights/route.ts
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
    const { searchParams } = new URL(request.url);

    // Parse period parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // Scope to authenticated user — prevent IDOR
    const userId = authUserId;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
    }

    const period = {
      start: new Date(startDate),
      end: new Date(endDate),
    };

    // Validate date range
    if (period.start >= period.end) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    // Generate insights
    const insights = await analyticsService.generateInsights(period, userId);

    return NextResponse.json({
      insights,
      period,
      userId,
      count: insights.length,
    });
  } catch (error) {
    logger.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
