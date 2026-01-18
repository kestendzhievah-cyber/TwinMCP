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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (service) {
      // Get SLOs for specific service
      const result = await db.query(
        'SELECT * FROM slos WHERE service = $1 ORDER BY created_at DESC',
        [service]
      );
      
      return NextResponse.json({
        service,
        slos: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          service: row.service,
          indicator: row.indicator,
          target: parseFloat(row.target),
          window: row.window,
          alerting: JSON.parse(row.alerting),
          current: JSON.parse(row.current),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    } else {
      // Get all SLOs
      const result = await db.query('SELECT * FROM slos ORDER BY created_at DESC');
      
      return NextResponse.json({
        slos: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          service: row.service,
          indicator: row.indicator,
          target: parseFloat(row.target),
          window: row.window,
          alerting: JSON.parse(row.alerting),
          current: JSON.parse(row.current),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    }
  } catch (error) {
    console.error('Error fetching SLOs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.service || !body.indicator || !body.target || !body.window) {
      return NextResponse.json(
        { error: 'Missing required fields: name, service, indicator, target, window' },
        { status: 400 }
      );
    }

    const slo = await monitoringService.createSLO({
      name: body.name,
      description: body.description || '',
      service: body.service,
      indicator: body.indicator,
      target: parseFloat(body.target),
      window: body.window,
      alerting: body.alerting || {
        errorBudgetAlerts: true,
        burnRateAlerts: true
      }
    });

    return NextResponse.json({
      success: true,
      slo
    });
  } catch (error) {
    console.error('Error creating SLO:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
