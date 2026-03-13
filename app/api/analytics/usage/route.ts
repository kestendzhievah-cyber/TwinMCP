// src/app/api/analytics/usage/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { AnalyticsFilter } from '@/src/types/analytics.types';
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

    // Parse optional filters (period is passed separately to getUsageMetrics)
    const filters: AnalyticsFilter = {};
    // Scope to authenticated user — prevent IDOR
    const userId = authUserId;
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
    const usageMetrics = await analyticsService.getUsageMetrics(
      period,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return NextResponse.json(usageMetrics);
  } catch (error) {
    return handleApiError(error, 'UsageMetrics');
  }
}
