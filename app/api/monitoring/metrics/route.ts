import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/src/services/monitoring.service';
import { MetricsCollector } from '@/src/services/metrics-collector.service';
import { AlertManager } from '@/src/services/alert-manager.service';
import { HealthChecker } from '@/src/services/health-checker.service';

// Initialize services (in production, use dependency injection)
import { pool as db } from '@/lib/prisma'
const metricsCollector = new MetricsCollector(db, redis);
const alertManager = new AlertManager(db, redis, { enabled: true, channels: [], escalation: [] });
const healthChecker = new HealthChecker(db, redis);
const monitoringConfig = {
  collection: { interval: 30, retention: 30, batchSize: 100 },
  alerts: { enabled: true, channels: [], escalation: [] },
  dashboards: { refreshInterval: 300, autoSave: true }
};
const monitoringService = new MonitoringService(db, redis, metricsCollector, alertManager, healthChecker, monitoringConfig);

export async function GET(request: NextRequest) {
  try {
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
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Trigger manual metrics collection
    const metrics = await monitoringService.collectMetrics();
    
    return NextResponse.json({
      success: true,
      timestamp: metrics.timestamp,
      metrics
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
