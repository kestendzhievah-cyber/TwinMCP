// src/app/api/analytics/patterns/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request.headers.get('authorization'));
    if (!authUserId) {
      throw new AuthenticationError();
    }

    const { analyticsService } = await getAnalyticsServices();
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
      end: new Date(endDate),
    };

    // Validate date range
    if (period.start >= period.end) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    // Get behavior patterns
    const patterns = await analyticsService.detectBehaviorPatterns(period);

    return NextResponse.json({
      patterns,
      period,
      count: patterns.length,
    });
  } catch (error) {
    return handleApiError(error, 'DetectPatterns');
  }
}
