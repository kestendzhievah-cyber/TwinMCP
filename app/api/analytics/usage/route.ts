// src/app/api/analytics/usage/route.ts
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { AnalyticsFilter } from '@/src/types/analytics.types';

export async function GET(request: NextRequest) {
  try {
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
      end: new Date(endDate)
    };

    // Validate date range
    if (period.start >= period.end) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Parse optional filters (period is passed separately to getUsageMetrics)
    const filters: AnalyticsFilter = {};
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider');
    const model = searchParams.get('model');
    const country = searchParams.get('country');
    const device = searchParams.get('device');

    if (userId) filters.userId = userId;
    if (provider) filters.provider = provider;
    if (model) filters.model = model;
    if (country) filters.country = country;
    if (device) filters.device = device;

    // Get usage metrics
    const usageMetrics = await analyticsService.getUsageMetrics(period, Object.keys(filters).length > 0 ? filters : undefined);

    return NextResponse.json(usageMetrics);
    
  } catch (error) {
    logger.error('Error fetching usage metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
