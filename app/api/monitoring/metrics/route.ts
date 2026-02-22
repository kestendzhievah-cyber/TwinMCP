import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringService } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const monitoringService = await getMonitoringService();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const interval = searchParams.get('interval') as '1m' | '5m' | '15m' | '1h' | '6h' | '1d' | undefined;

    if (period) {
      // Parse period (e.g., "1h", "24h", "7d")
      const periodMatch = period.match(/(\d+)([hdwmy])/);
      if (!periodMatch) {
        return NextResponse.json(
          { error: 'Invalid period format. Use format like "1h", "24h", "7d"' },
          { status: 400 }
        );
      }

      const value = parseInt(periodMatch[1]);
      const unit = periodMatch[2];
      
      let endDate = new Date();
      let startDate = new Date();
      
      switch (unit) {
        case 'h':
          startDate.setHours(startDate.getHours() - value);
          break;
        case 'd':
          startDate.setDate(startDate.getDate() - value);
          break;
        case 'w':
          startDate.setDate(startDate.getDate() - value * 7);
          break;
        case 'm':
          startDate.setMonth(startDate.getMonth() - value);
          break;
        case 'y':
          startDate.setFullYear(startDate.getFullYear() - value);
          break;
      }

      const metrics = await monitoringService.getMetricsHistory(
        { start: startDate, end: endDate },
        interval || '5m'
      );

      return NextResponse.json({
        period: { start: startDate, end: endDate },
        interval: interval || '5m',
        metrics,
        count: metrics.length
      });
    } else {
      // Get current metrics
      const currentMetrics = await monitoringService.getCurrentMetrics();
      return NextResponse.json({
        timestamp: currentMetrics.timestamp,
        metrics: currentMetrics
      });
    }
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const monitoringService = await getMonitoringService();
    const body = await request.json();
    
    // Trigger manual metrics collection
    const metrics = await monitoringService.collectMetrics();
    
    return NextResponse.json({
      success: true,
      timestamp: metrics.timestamp,
      metrics
    });
  } catch (error) {
    logger.error('Error collecting metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
