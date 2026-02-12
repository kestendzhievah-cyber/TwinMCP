import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/src/services/monitoring.service';
import { MetricsCollector } from '@/src/services/metrics-collector.service';
import { AlertManager } from '@/src/services/alert-manager.service';
import { HealthChecker } from '@/src/services/health-checker.service';

// Initialize services
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
    const service = searchParams.get('service');

    if (service) {
      // Get health check for specific service
      const healthCheck = await healthChecker.checkService(service);
      return NextResponse.json({
        service: healthCheck.service,
        status: healthCheck.status,
        timestamp: healthCheck.timestamp,
        responseTime: healthCheck.responseTime,
        details: healthCheck.details,
        dependencies: healthCheck.dependencies
      });
    } else {
      // Get overall system health
      const systemHealth = await monitoringService.getSystemHealth();
      return NextResponse.json({
        status: systemHealth.status,
        services: systemHealth.services,
        summary: {
          total: systemHealth.services.length,
          healthy: systemHealth.services.filter(s => s.status === 'healthy').length,
          degraded: systemHealth.services.filter(s => s.status === 'degraded').length,
          unhealthy: systemHealth.services.filter(s => s.status === 'unhealthy').length
        }
      });
    }
  } catch (error) {
    console.error('Error fetching health status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.service) {
      return NextResponse.json(
        { error: 'Missing required field: service' },
        { status: 400 }
      );
    }

    // Trigger health check for specific service
    const healthCheck = await healthChecker.checkService(body.service);

    return NextResponse.json({
      success: true,
      healthCheck
    });
  } catch (error) {
    console.error('Error performing health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
