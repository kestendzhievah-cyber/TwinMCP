import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { MonitoringService } from '@/services/monitoring.service';
import { MetricsCollector } from '@/services/metrics-collector.service';
import { AlertManager } from '@/services/alert-manager.service';
import { HealthChecker } from '@/services/health-checker.service';

// Initialize services
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const metricsCollector = new MetricsCollector(db, redis);
const alertManager = new AlertManager(db, redis, { enabled: true, channels: [], escalation: [] });
const healthChecker = new HealthChecker(db, redis);
const monitoringConfig = {
  collection: { interval: 30, retention: 30, batchSize: 100 },
  alerts: { enabled: true, channels: [], escalation: [] },
  dashboards: { refreshInterval: 300, autoSave: true }
};
const monitoringService = new MonitoringService(db, redis, metricsCollector, alertManager, healthChecker, monitoringConfig);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const alertId = params.id;
    const body = await request.json();
    
    if (!body.userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    const alert = await monitoringService.resolveAlert(alertId, body.userId);

    return NextResponse.json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
