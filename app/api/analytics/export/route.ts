// src/app/api/analytics/export/route.ts
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { AnalyticsQuery } from '@/src/types/analytics.types';

export async function POST(request: NextRequest) {
  try {
    const { analyticsService } = await getAnalyticsServices();
    const body = await request.json();
    
    // Validate required fields
    const { query, format } = body;
    
    if (!query || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: query, format' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['csv', 'json', 'xlsx', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate timeRange presence
    if (!query.timeRange?.start || !query.timeRange?.end) {
      return NextResponse.json(
        { error: 'Missing required field: query.timeRange with start and end' },
        { status: 400 }
      );
    }

    // Validate query structure
    const analyticsQuery: AnalyticsQuery = {
      metrics: query.metrics || [],
      dimensions: query.dimensions || [],
      filters: query.filters || {},
      timeRange: {
        start: new Date(query.timeRange.start),
        end: new Date(query.timeRange.end)
      },
      granularity: query.granularity || 'day',
      limit: query.limit,
      offset: query.offset
    };

    // Validate time range
    if (analyticsQuery.timeRange.start >= analyticsQuery.timeRange.end) {
      return NextResponse.json(
        { error: 'timeRange.start must be before timeRange.end' },
        { status: 400 }
      );
    }

    // Create export job
    const exportJob = await analyticsService.exportData(analyticsQuery, format);

    return NextResponse.json({
      exportId: exportJob.id,
      status: exportJob.status,
      message: 'Export job created successfully'
    });
    
  } catch (error) {
    logger.error('Error creating export job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { analyticsService } = await getAnalyticsServices();
    const { searchParams } = new URL(request.url);
    const exportId = searchParams.get('exportId');
    
    if (!exportId) {
      return NextResponse.json(
        { error: 'Missing required parameter: exportId' },
        { status: 400 }
      );
    }

    // Get export status
    const exportStatus = await analyticsService.getExportStatus(exportId);
    
    if (!exportStatus) {
      return NextResponse.json(
        { error: 'Export not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(exportStatus);
    
  } catch (error) {
    logger.error('Error fetching export status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
